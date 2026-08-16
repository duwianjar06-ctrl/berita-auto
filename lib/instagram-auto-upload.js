import {getJson,setJson,listJson,acquireLock,releaseLock} from './persistence.js';
import {getInstagramAutomationSettings} from './instagram-automation.js';
import {listInstagramReviewQueue,publishInstagramReviewItem} from './instagram-review.js';

const AUTO_LOCK='ba:social:instagram:auto-upload:lock';
const LAST_PUBLISH_KEY='ba:social:instagram:auto-upload:last-publish';

export async function runInstagramAutoUpload({trigger='scheduled',now=Date.now()}={}){
  const settings=await getInstagramAutomationSettings();
  if(!settings.autoUploadEnabled)return{status:'skipped',reason:'auto_upload_off',metaCalls:0};
  const lockToken=`${trigger}:${now}:${Math.random().toString(36).slice(2,8)}`;
  if(!(await acquireLock(AUTO_LOCK,lockToken,180)))return{status:'skipped',reason:'auto_upload_lock_busy',metaCalls:0};
  try{
    const last=await getJson(LAST_PUBLISH_KEY);
    const lastAt=Date.parse(last?.publishedAt||'');
    const intervalMs=settings.autoUploadIntervalMinutes*60*1000;
    if(Number.isFinite(lastAt)&&now-lastAt<intervalMs)return{status:'skipped',reason:'interval_backoff',nextAt:new Date(lastAt+intervalMs).toISOString(),metaCalls:0};
    const rows=await listInstagramReviewQueue();
    const candidate=rows.find(row=>row?.status==='READY'&&!row?.removedAt&&!row?.postedAt&&!row?.mediaId);
    if(!candidate)return{status:'skipped',reason:'no_ready_item',metaCalls:0};
    const posted=await publishInstagramReviewItem(candidate.queueId,{idempotencyKey:`auto:${candidate.queueId}:${now}`});
    await setJson(LAST_PUBLISH_KEY,{queueId:posted.queueId,publishedAt:posted.publishedAt||new Date(now).toISOString()});
    return{status:'published',queueId:posted.queueId,articleId:posted.articleId,mediaId:posted.mediaId||null,metaCalls:posted.mediaId?2:0};
  }finally{await releaseLock(AUTO_LOCK,lockToken).catch(()=>{});}
}
