import {getJson,setJson,acquireLock,releaseLock} from './persistence.js';
import {getInstagramAutomationSettings} from './instagram-automation.js';
import {listInstagramReviewQueue,publishInstagramReviewItem} from './instagram-review.js';
import {getInstagramPublishGate,getInstagramPublishThrottle,bulkEnqueueInstagramPublishItems,listInstagramPublishQueue,publishInstagramReviewItemQueued,clearInstagramPublishThrottle,isMetaActionThrottle,activateInstagramActionThrottle,getInstagramPublishQueueSnapshot} from './instagram-publish-queue.js';

export const INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS=5*60*1000;
export const INSTAGRAM_PUBLISH_CLOCK_TOLERANCE_MS=30*1000;
const AUTO_LOCK='ba:social:instagram:auto-upload:lock',LAST_PUBLISH_KEY='ba:social:instagram:auto-upload:last-publish';
const isReady=row=>row?.status==='READY'&&!row?.removedAt&&!row?.postedAt&&!row?.mediaId;

export function getInstagramPublishPacing(lastPublish,{now=Date.now(),intervalMs=INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS,toleranceMs=INSTAGRAM_PUBLISH_CLOCK_TOLERANCE_MS}={}){
  const publishedAt=Date.parse(lastPublish?.publishedAt||'');
  const storedNextAllowedAt=Date.parse(lastPublish?.nextAllowedAt||'');
  const nextAllowedAt=Number.isFinite(storedNextAllowedAt)?storedNextAllowedAt:(Number.isFinite(publishedAt)?publishedAt+intervalMs:null);
  if(!Number.isFinite(nextAllowedAt))return{eligible:true,lastSuccessAt:null,nextAllowedAt:null,intervalRemainingMs:0};
  const remainingMs=Math.max(0,nextAllowedAt-now);
  return{eligible:now+toleranceMs>=nextAllowedAt,lastSuccessAt:Number.isFinite(publishedAt)?new Date(publishedAt).toISOString():null,nextAllowedAt:new Date(nextAllowedAt).toISOString(),intervalRemainingMs:remainingMs};
}

export async function runInstagramAutoUpload({trigger='scheduled',now=Date.now()}={}){
  const settings=await getInstagramAutomationSettings();
  const base={autoUploadEnabled:settings.autoUploadEnabled,autoPublishTriggered:true,readyFound:0,eligibleReady:0,publishAttempted:0,publishPosted:0,publishFailed:0,remainingReady:0,remainingQueued:null,rateLimited:false,actionThrottled:false,metaCalls:0,skipReason:null,metaErrorCode:null,metaErrorSubcode:null,lastSuccessAt:null,nextAllowedAt:null,intervalRemainingMs:0};
  if(!settings.autoUploadEnabled)return{status:'skipped',reason:'auto_upload_off',...base,autoPublishTriggered:false};
  const throttle=await getInstagramPublishThrottle({now});
  if(throttle.active&&!throttle.probeDue)return{status:'skipped',reason:'META_ACTION_THROTTLE',...base,rateLimited:true,actionThrottled:true,estimatedResumeAt:throttle.estimatedResumeAt,nextProbeAt:throttle.nextProbeAt};
  const token=`${trigger}:${now}:${Math.random().toString(36).slice(2,8)}`;
  if(!(await acquireLock(AUTO_LOCK,token,180)))return{status:'skipped',reason:'auto_upload_lock_busy',...base,autoPublishTriggered:false};
  const start=Date.now();
  try{
    if(trigger!=='scheduled')process.env.INSTAGRAM_PUBLISH_MODE='review';
    let gate=null;
    if(throttle.active&&throttle.probeDue){gate=await getInstagramPublishGate({now});base.metaCalls+=Number(gate.metaCalls||0);base.rateLimited=Boolean(gate.rateLimited);base.actionThrottled=Boolean(gate.actionThrottled);base.skipReason=gate.allowed?null:gate.reason;base.metaErrorCode=gate.metaErrorCode||null;base.metaErrorSubcode=gate.metaErrorSubcode||null;if(!gate.allowed)return{status:'queued',reason:gate.reason,...base,estimatedResumeAt:gate.estimatedResumeAt||gate.nextProbeAt||null,nextProbeAt:gate.nextProbeAt||null,publishingUsage:gate.publishingUsage||null,durationMs:Date.now()-start};}
    const rows=await listInstagramReviewQueue();
    const readyRows=rows.filter(isReady);
    base.readyFound=readyRows.length;
    if(readyRows.length)await bulkEnqueueInstagramPublishItems(readyRows,{reason:'AUTO_UPLOAD',status:'QUEUED',now});
    let queue=await listInstagramPublishQueue();
    base.eligibleReady=queue.length;base.remainingQueued=queue.length;
    const immediate=/immediate|prepare|kick/i.test(trigger);
    const last=await getJson(LAST_PUBLISH_KEY);
    const pacing=getInstagramPublishPacing(last,{now});
    base.lastSuccessAt=pacing.lastSuccessAt;base.nextAllowedAt=pacing.nextAllowedAt;base.intervalRemainingMs=pacing.intervalRemainingMs;
    if(!immediate&&!pacing.eligible){return{status:'queued',reason:'interval_backoff',nextAt:pacing.nextAllowedAt,...base,remainingReady:base.readyFound,durationMs:Date.now()-start};}
    if(!gate){gate=await getInstagramPublishGate({now});base.metaCalls+=Number(gate.metaCalls||0);base.rateLimited=Boolean(gate.rateLimited);base.actionThrottled=Boolean(gate.actionThrottled);base.skipReason=gate.allowed?null:gate.reason;base.metaErrorCode=gate.metaErrorCode||null;base.metaErrorSubcode=gate.metaSubcode||null;}
    if(!gate.allowed){base.remainingQueued=queue.length;return{status:'queued',reason:gate.reason,...base,estimatedResumeAt:gate.estimatedResumeAt||gate.nextProbeAt||null,nextProbeAt:gate.nextProbeAt||null,publishingUsage:gate.publishingUsage||null,durationMs:Date.now()-start};}
    const candidate=queue.find(row=>{const next=Date.parse(row.nextPublishAttemptAt||'');return!Number.isFinite(next)||next<=now;});
    if(!candidate){base.skipReason='no_ready_item';base.remainingQueued=queue.length;return{status:'skipped',reason:'no_ready_item',...base,durationMs:Date.now()-start};}
    const published=await publishInstagramReviewItemQueued(candidate.queueId,publishInstagramReviewItem,{now,prechecked:true,publishingUsage:gate.publishingUsage,idempotencyKey:`auto:${candidate.queueId}:${now}`});
    if(published.status==='queued'){
      base.publishAttempted=published.reason==='META_ACTION_PROBE_BUSY'?0:1;
      base.publishFailed=published.reason==='META_ACTION_PROBE_BUSY'?0:1;base.rateLimited=published.reason==='META_ACTION_THROTTLE'||base.rateLimited;base.actionThrottled=published.reason==='META_ACTION_THROTTLE'||base.actionThrottled;base.skipReason=published.reason;base.metaErrorCode=published.metaErrorCode||base.metaErrorCode;base.metaErrorSubcode=published.metaErrorSubcode||base.metaErrorSubcode;base.remainingQueued=null;
      return{status:'partial',reason:published.reason,...base,item:published.item,estimatedResumeAt:published.estimatedResumeAt,durationMs:Date.now()-start};
    }
    base.publishAttempted=1;
    base.metaCalls+=Number(published.metaCalls||0);
    if(published.status==='published'){
      base.publishPosted=1;
      const publishedAt=Date.parse(published.item?.publishedAt||'');
      const successAt=Number.isFinite(publishedAt)?publishedAt:Date.now();
      const nextAllowedAt=successAt+INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS;
      base.lastSuccessAt=new Date(successAt).toISOString();
      base.nextAllowedAt=new Date(nextAllowedAt).toISOString();
      base.intervalRemainingMs=INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS;
      await clearInstagramPublishThrottle({now:Date.now()});
      await setJson(LAST_PUBLISH_KEY,{queueId:published.item.queueId,publishedAt:base.lastSuccessAt,nextAllowedAt:base.nextAllowedAt});
    }
    base.remainingQueued=null;base.remainingReady=null;
    return{status:base.publishPosted?'partial':'skipped',reason:base.publishPosted?'safe_pacing_remaining':'publish_failed_or_stale',...base,item:published.item||null,durationMs:Date.now()-start};
  }catch(error){
    if(isMetaActionThrottle(error)){const throttle=await activateInstagramActionThrottle(error,{now:Date.now()});base.rateLimited=true;base.actionThrottled=true;base.skipReason='META_ACTION_THROTTLE';base.metaErrorCode=Number(error?.metaCode||throttle.metaCode||9);base.metaErrorSubcode=Number(error?.metaSubcode||throttle.metaSubcode||0)||null;base.metaCalls+=Number(error?.metaCalls||1);base.remainingQueued=null;return{status:'partial',reason:'META_ACTION_THROTTLE',...base,estimatedResumeAt:throttle.estimatedResumeAt,nextProbeAt:throttle.nextProbeAt,durationMs:Date.now()-start};}
    base.publishFailed=base.publishAttempted?1:0;base.skipReason=String(error?.message||error).slice(0,240);base.metaCalls+=Number(error?.metaCalls||0);base.remainingQueued=null;return{status:'failed',reason:'publish_failed',...base,durationMs:Date.now()-start};
  }finally{await releaseLock(AUTO_LOCK,token).catch(()=>{})}
}
export async function kickInstagramPublisher(){return runInstagramAutoUpload({trigger:'prepare-immediate',now:Date.now()});}
export async function getInstagramAutoUploadTelemetry(){const snapshot=await getInstagramPublishQueueSnapshot({now:Date.now()});const last=await getJson(LAST_PUBLISH_KEY);const pacing=getInstagramPublishPacing(last,{now:Date.now()});return{autoUploadEnabled:(await getInstagramAutomationSettings()).autoUploadEnabled,normalIntervalMs:INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS,clockToleranceMs:INSTAGRAM_PUBLISH_CLOCK_TOLERANCE_MS,lastSuccessAt:pacing.lastSuccessAt,nextAllowedAt:pacing.nextAllowedAt,intervalRemainingMs:pacing.intervalRemainingMs,queue:snapshot};}