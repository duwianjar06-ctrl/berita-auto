import {listInstagramReviewQueue,REVIEW_QUEUE_INDEX} from './instagram-review.js';
import {INSTAGRAM_PUBLISH_QUEUE_INDEX} from './instagram-publish-queue.js';
import {removeIndexedMany,setRemoveMany,msetJson,withPersistenceSource} from './persistence.js';

const itemKey=id=>`ba:social:instagram:review:item:${id}`;
const removedKey=id=>`ba:social:instagram:review:removed:${id}`;
const SAFE_STATUSES=new Set(['READY','FAILED','ATTENTION','PERLU_PERHATIAN','PREPARING','WAITING_META','QUEUED']);
const IMMUTABLE_STATUSES=new Set(['POSTED','PUBLISHING']);

export function selectLegacyInstagramCandidates(rows,{cutoverAt}={}){
  const cutoff=Date.parse(cutoverAt||'');
  if(!Number.isFinite(cutoff))throw new Error('legacy_cleanup_cutover_invalid');
  return (Array.isArray(rows)?rows:[]).filter(row=>{
    const status=String(row?.status||'').toUpperCase();
    if(IMMUTABLE_STATUSES.has(status)||!SAFE_STATUSES.has(status))return false;
    if(row?.postedAt||row?.mediaId)return false;
    const prepared=Date.parse(row?.preparedAt||'');
    return Number.isFinite(prepared)&&prepared<cutoff;
  });
}

export async function cleanupLegacyInstagramBatch({cutoverAt,dryRun=true,removedBy='legacy-cutover'}={}){
  return withPersistenceSource('admin-instagram-cleanup',async()=>{
    const rows=await listInstagramReviewQueue();
    const candidates=selectLegacyInstagramCandidates(rows,{cutoverAt});
    const summary={cutoverAt,candidates:candidates.length,removed:0,skippedPosted:0,skippedPublishing:0,skippedMediaId:0,dryRun,queueIds:candidates.map(row=>row.queueId)};
    if(dryRun)return summary;
    const keys=candidates.map(row=>itemKey(row.queueId));
    const removedAt=new Date().toISOString();
    const tombstones=candidates.map(row=>[removedKey(row.articleId),{articleId:row.articleId,queueId:row.queueId,removedAt,removedBy,removeReason:'legacy_design_cutover'}]);
    if(tombstones.length)await msetJson(tombstones);
    if(keys.length){await removeIndexedMany(REVIEW_QUEUE_INDEX,keys);await setRemoveMany(INSTAGRAM_PUBLISH_QUEUE_INDEX,keys);}
    summary.removed=candidates.length;
    return summary;
  });
}
