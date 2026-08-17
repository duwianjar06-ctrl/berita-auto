import {getJson,setJson,setAdd,setRemove,setMembers} from './persistence.js';
import {getPublishingUsage,classifyInstagramError} from './instagram.js';
import {readRecentPublished} from './social.js';

export const INSTAGRAM_PUBLISH_QUEUE_INDEX='ba:social:instagram:publish-queue:index';
export const INSTAGRAM_PUBLISH_THROTTLE_KEY='ba:social:instagram:publish-throttle';
export const INSTAGRAM_PUBLISHING_USAGE_KEY='ba:social:instagram:publishing-usage';
const REVIEW_ITEM=id=>`ba:social:instagram:review:item:${id}`;
const REMOVED_KEY=id=>`ba:social:instagram:review:removed:${id}`;
const BACKOFF_MS=[30*60*1000,60*60*1000,2*60*60*1000,4*60*60*1000,6*60*60*1000];
const nowIso=now=>new Date(now).toISOString();
const isQueued=row=>['QUEUED','WAITING_META'].includes(String(row?.status||'').toUpperCase());
const isReady=row=>row?.status==='READY'&&!row?.removedAt&&!row?.postedAt&&!row?.mediaId;

export function classifyInstagramPublishFailure(error){
  const classification=classifyInstagramError(error);
  const code=Number(error?.metaCode||classification?.metaCode||0);
  const subcode=Number(error?.metaSubcode||classification?.metaSubcode||0);
  const message=String(error?.message||'');
  if(code===9&&subcode===2207069&&/user is performing too many actions/i.test(message)){
    return{...classification,kind:'transient',reason:'META_ACTION_THROTTLE',metaCode:9,metaSubcode:2207069,isRateLimited:true,isActionThrottled:true};
  }
  return{...classification,isRateLimited:classification?.kind==='transient'&&['rate_limited','meta_publishing_limit'].includes(classification?.reason),isActionThrottled:false};
}

export function isMetaActionThrottle(error){const x=classifyInstagramPublishFailure(error);return x.reason==='META_ACTION_THROTTLE'&&x.metaCode===9&&x.metaSubcode===2207069;}

export function throttleBackoffMs(consecutiveThrottleCount){return BACKOFF_MS[Math.max(0,Math.min(BACKOFF_MS.length-1,Number(consecutiveThrottleCount||1)-1))];}

export async function getInstagramPublishThrottle({now=Date.now()}={}){
  const stored=await getJson(INSTAGRAM_PUBLISH_THROTTLE_KEY);
  if(!stored)return{active:false,probeDue:false,consecutiveThrottleCount:0};
  const nextProbeAt=Date.parse(stored.nextProbeAt||'');
  return{...stored,active:Boolean(stored.active),probeDue:Boolean(stored.active&&Number.isFinite(nextProbeAt)&&now>=nextProbeAt)};
}

export async function activateInstagramActionThrottle(error,{now=Date.now()}={}){
  const previous=await getJson(INSTAGRAM_PUBLISH_THROTTLE_KEY);
  const same=Number(previous?.metaCode)===9&&Number(previous?.metaSubcode)===2207069;
  const consecutiveThrottleCount=same?Number(previous?.consecutiveThrottleCount||0)+1:1;
  const nextProbeAt=now+throttleBackoffMs(consecutiveThrottleCount);
  const next={active:true,reason:'META_ACTION_THROTTLE',metaCode:9,metaSubcode:2207069,firstSeenAt:previous?.firstSeenAt||nowIso(now),lastSeenAt:nowIso(now),consecutiveThrottleCount,nextProbeAt:nowIso(nextProbeAt),estimatedResumeAt:nowIso(nextProbeAt),updatedAt:nowIso(now)};
  await setJson(INSTAGRAM_PUBLISH_THROTTLE_KEY,next);
  return next;
}

export async function clearInstagramPublishThrottle({now=Date.now()}={}){
  const current=await getJson(INSTAGRAM_PUBLISH_THROTTLE_KEY);
  if(!current)return{active:false,clearedAt:nowIso(now)};
  const next={...current,active:false,probeDue:false,clearedAt:nowIso(now),updatedAt:nowIso(now),consecutiveThrottleCount:0};
  await setJson(INSTAGRAM_PUBLISH_THROTTLE_KEY,next);
  return next;
}

export async function persistInstagramPublishingUsage(usage,{now=Date.now()}={}){
  const snapshot={available:Boolean(usage?.available),usage:usage?.usage??null,total:usage?.total??null,remaining:usage?.remaining??null,durationSeconds:usage?.durationSeconds??null,checkedAt:nowIso(now),metaErrorCode:usage?.metaCode||null,metaErrorSubcode:usage?.metaSubcode||null,reason:usage?.reason||null};
  await setJson(INSTAGRAM_PUBLISHING_USAGE_KEY,snapshot);
  return snapshot;
}

export async function estimatePublishingQuotaResumeAt(usage,{now=Date.now()}={}){
  if(!usage?.available||Number(usage.remaining)>0)return null;
  const durationMs=Math.max(60*60*1000,Number(usage.durationSeconds||86400)*1000);
  const recent=await readRecentPublished(200);
  const cutoff=now-durationMs;
  const timestamps=recent.map(row=>Date.parse(row?.publishedAt||'')).filter(value=>Number.isFinite(value)&&value>=cutoff).sort((a,b)=>a-b);
  return timestamps.length?nowIso(timestamps[0]+durationMs):null;
}

export async function getInstagramPublishGate({now=Date.now()}={}){
  const throttle=await getInstagramPublishThrottle({now});
  if(throttle.active&&!throttle.probeDue){return{allowed:false,reason:'META_ACTION_THROTTLE',actionThrottled:true,rateLimited:true,estimatedResumeAt:throttle.estimatedResumeAt,nextProbeAt:throttle.nextProbeAt,metaCalls:0,publishingUsage:await getJson(INSTAGRAM_PUBLISHING_USAGE_KEY)};}
  try{
    const usage=await getPublishingUsage();
    await persistInstagramPublishingUsage(usage,{now});
    if(usage?.available===false)return{allowed:false,reason:'META_PUBLISHING_QUOTA_UNKNOWN',actionThrottled:false,rateLimited:false,metaCalls:1,publishingUsage:usage};
    if(Number(usage.remaining)<=0){
      const estimatedResumeAt=await estimatePublishingQuotaResumeAt(usage,{now});
      return{allowed:false,reason:'META_PUBLISHING_QUOTA',actionThrottled:false,rateLimited:true,estimatedResumeAt,metaCalls:1,publishingUsage:usage};
    }
    return{allowed:true,reason:'READY',actionThrottled:false,rateLimited:false,metaCalls:1,publishingUsage:usage};
  }catch(error){
    if(isMetaActionThrottle(error)){
      const next=await activateInstagramActionThrottle(error,{now});
      return{allowed:false,reason:'META_ACTION_THROTTLE',actionThrottled:true,rateLimited:true,estimatedResumeAt:next.estimatedResumeAt,nextProbeAt:next.nextProbeAt,metaCalls:1,publishingUsage:null,metaErrorCode:9,metaErrorSubcode:2207069};
    }
    throw error;
  }
}

export async function enqueueInstagramPublishItem(row,{reason='AUTO_UPLOAD',status='QUEUED',now=Date.now(),estimatedResumeAt=null}={}){
  if(!row?.queueId)throw new Error('instagram_publish_queue_id_missing');
  const key=REVIEW_ITEM(row.queueId);
  const current=await getJson(key)||row;
  if(['POSTED','REMOVED'].includes(String(current?.status||'').toUpperCase()))return current;
  const queuedAt=current.queuedAt||nowIso(now);
  const next={...current,status,queuedAt,queuedBy:current.queuedBy||reason,priority:Number(current.priority||0),priorityUpdatedAt:current.priorityUpdatedAt||queuedAt,nextPublishAttemptAt:estimatedResumeAt||current.nextPublishAttemptAt||nowIso(now),blockedReason:reason,estimatedResumeAt:estimatedResumeAt||current.estimatedResumeAt||null,updatedAt:nowIso(now),publishAttemptCount:Number(current.publishAttemptCount||0),lastPublishAttemptAt:current.lastPublishAttemptAt||null};
  await setJson(key,next);
  await setAdd(INSTAGRAM_PUBLISH_QUEUE_INDEX,key);
  return next;
}

export async function listInstagramPublishQueue(){
  const keys=await setMembers(INSTAGRAM_PUBLISH_QUEUE_INDEX);
  const rows=await Promise.all((keys||[]).map(key=>getJson(key)));
  return rows.filter(isQueued).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)||Date.parse(a.queuedAt||a.createdAt||'')-Date.parse(b.queuedAt||b.createdAt||''));
}

export async function prioritizeInstagramPublishQueueItem(queueId,priority=100){
  const key=REVIEW_ITEM(queueId);const row=await getJson(key);if(!row||!isQueued(row))throw new Error('instagram_publish_queue_item_not_found');
  const next={...row,priority:Number(priority),priorityUpdatedAt:nowIso(Date.now()),updatedAt:nowIso(Date.now())};await setJson(key,next);await setAdd(INSTAGRAM_PUBLISH_QUEUE_INDEX,key);return next;
}

export async function normalizeInstagramPublishQueueItem(queueId){return prioritizeInstagramPublishQueueItem(queueId,0);}

export async function removeInstagramPublishQueueItem(queueId,{removedBy=null,reason='admin_queue_remove'}={}){
  const key=REVIEW_ITEM(queueId);const row=await getJson(key);if(!row)throw new Error('instagram_publish_queue_item_not_found');
  if(row.status==='PUBLISHING')throw new Error('publish_queue_item_publishing');
  if(row.status==='POSTED')throw new Error('publish_queue_item_posted');
  const removedAt=nowIso(Date.now());const next={...row,status:'REMOVED',removedAt,removedBy,removedReason:reason,updatedAt:removedAt};await setJson(key,next);await setRemove(INSTAGRAM_PUBLISH_QUEUE_INDEX,key);await setJson(REMOVED_KEY(row.articleId),{articleId:row.articleId,queueId,removedAt,removedBy,removeReason:reason});return next;
}

export async function requeueInstagramPublishItem(row,{reason='META_ACTION_THROTTLE',estimatedResumeAt=null,now=Date.now()}={}){
  return enqueueInstagramPublishItem({...row,status:'WAITING_META',blockedReason:reason,estimatedResumeAt,nextPublishAttemptAt:estimatedResumeAt},{reason,status:'WAITING_META',now,estimatedResumeAt});
}

export async function prepareQueuedItemForPublish(queueId,{now=Date.now()}={}){
  const key=REVIEW_ITEM(queueId);const row=await getJson(key);if(!row||!isQueued(row))throw new Error('instagram_publish_queue_item_not_ready');
  const nextAttempt=Date.parse(row.nextPublishAttemptAt||'');if(Number.isFinite(nextAttempt)&&nextAttempt>now)throw new Error('publish_queue_backoff_active');
  const next={...row,status:'READY',currentStage:'QUEUE_DEQUEUED',updatedAt:nowIso(now),lastPublishAttemptAt:nowIso(now),publishAttemptCount:Number(row.publishAttemptCount||0)+1};await setJson(key,next);return next;
}

export async function publishInstagramReviewItemQueued(queueId,publishFn,{now=Date.now(),prechecked=false}={}){
  const key=REVIEW_ITEM(queueId);const row=await getJson(key);if(!row)throw new Error('review_item_not_found');
  if(row.status==='REMOVED')throw new Error('review_item_removed');
  if(row.status==='POSTED')return{status:'already_posted',item:row,metaCalls:0};
  const gate=prechecked?{allowed:true,metaCalls:0}:await getInstagramPublishGate({now});
  if(!gate.allowed){
    const queued=await requeueInstagramPublishItem(row,{reason:gate.reason,estimatedResumeAt:gate.estimatedResumeAt||gate.nextProbeAt||null,now});
    return{status:'queued',reason:gate.reason,item:queued,position:(await listInstagramPublishQueue()).findIndex(x=>x.queueId===queueId)+1,metaCalls:gate.metaCalls||0,publishingUsage:gate.publishingUsage||null,estimatedResumeAt:gate.estimatedResumeAt||gate.nextProbeAt||null};
  }
  const candidate=row.status==='READY'?row:await prepareQueuedItemForPublish(queueId,{now});
  try{
    const published=await publishFn(queueId);
    await clearInstagramPublishThrottle({now:Date.now()});
    return{status:'published',item:published,metaCalls:1,publishingUsage:gate.publishingUsage||null};
  }catch(error){
    if(isMetaActionThrottle(error)){
      const throttle=await activateInstagramActionThrottle(error,{now:Date.now()});
      const current=await getJson(key)||candidate;
      const queued=await requeueInstagramPublishItem(current,{reason:'META_ACTION_THROTTLE',estimatedResumeAt:throttle.estimatedResumeAt,now:Date.now()});
      return{status:'queued',reason:'META_ACTION_THROTTLE',item:queued,position:(await listInstagramPublishQueue()).findIndex(x=>x.queueId===queueId)+1,metaCalls:Number(error?.metaCalls||1)+Number(gate.metaCalls||0),metaErrorCode:9,metaErrorSubcode:2207069,estimatedResumeAt:throttle.estimatedResumeAt};
    }
    throw error;
  }
}

export async function getInstagramPublishQueueSnapshot({now=Date.now()}={}){
  const [queue,throttle,publishingUsage]=await Promise.all([listInstagramPublishQueue(),getInstagramPublishThrottle({now}),getJson(INSTAGRAM_PUBLISHING_USAGE_KEY)]);
  const items=queue.map((row,index)=>({...row,position:index+1}));
  return{items,counts:{queued:items.filter(x=>x.status==='QUEUED').length,waitingMeta:items.filter(x=>x.status==='WAITING_META').length},throttle,publishingUsage,refreshedAt:nowIso(now)};
}
