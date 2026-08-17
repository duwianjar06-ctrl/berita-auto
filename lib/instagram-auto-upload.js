import {getJson,setJson,acquireLock,releaseLock} from './persistence.js';
import {getInstagramAutomationSettings} from './instagram-automation.js';
import {listInstagramReviewQueue,publishInstagramReviewItem} from './instagram-review.js';
import {getInstagramPublishGate,getInstagramPublishThrottle,bulkEnqueueInstagramPublishItems,listInstagramPublishQueue,prepareQueuedItemForPublish,publishInstagramReviewItemQueued,clearInstagramPublishThrottle,isMetaActionThrottle,activateInstagramActionThrottle,getInstagramPublishQueueSnapshot} from './instagram-publish-queue.js';
const AUTO_LOCK='ba:social:instagram:auto-upload:lock',LAST_PUBLISH_KEY='ba:social:instagram:auto-upload:last-publish';
const isReady=row=>row?.status==='READY'&&!row?.removedAt&&!row?.postedAt&&!row?.mediaId;
export async function runInstagramAutoUpload({trigger='scheduled',now=Date.now()}={}){
  const settings=await getInstagramAutomationSettings();
  const base={autoUploadEnabled:settings.autoUploadEnabled,autoPublishTriggered:true,readyFound:0,eligibleReady:0,publishAttempted:0,publishPosted:0,publishFailed:0,remainingReady:0,remainingQueued:null,rateLimited:false,actionThrottled:false,metaCalls:0,skipReason:null,metaErrorCode:null,metaErrorSubcode:null};
  if(!settings.autoUploadEnabled)return{status:'skipped',reason:'auto_upload_off',...base,autoPublishTriggered:false};
  const throttle=await getInstagramPublishThrottle({now});
  if(throttle.active&&!throttle.probeDue)return{status:'skipped',reason:'META_ACTION_THROTTLE',...base,rateLimited:true,actionThrottled:true,estimatedResumeAt:throttle.estimatedResumeAt,nextProbeAt:throttle.nextProbeAt};
  const token=`${trigger}:${now}:${Math.random().toString(36).slice(2,8)}`;
  if(!(await acquireLock(AUTO_LOCK,token,180)))return{status:'skipped',reason:'auto_upload_lock_busy',...base,autoPublishTriggered:false};
  const start=Date.now();
  try{
    if(trigger!=='scheduled')process.env.INSTAGRAM_PUBLISH_MODE='review';
    const rows=await listInstagramReviewQueue();
    const readyRows=rows.filter(isReady);
    base.readyFound=readyRows.length;
    if(readyRows.length)await bulkEnqueueInstagramPublishItems(readyRows,{reason:'AUTO_UPLOAD',status:'QUEUED',now});
    let queue=await listInstagramPublishQueue();
    base.eligibleReady=queue.length;base.remainingQueued=queue.length;
    const immediate=/immediate|prepare|kick/i.test(trigger);
    const last=await getJson(LAST_PUBLISH_KEY);const lastAt=Date.parse(last?.publishedAt||'');const interval=settings.autoUploadIntervalMinutes*60000;
    if(!immediate&&Number.isFinite(lastAt)&&now-lastAt<interval){return{status:'queued',reason:'interval_backoff',nextAt:new Date(lastAt+interval).toISOString(),...base,remainingReady:base.readyFound,durationMs:Date.now()-start};}
    const gate=await getInstagramPublishGate({now});base.metaCalls+=Number(gate.metaCalls||0);base.rateLimited=Boolean(gate.rateLimited);base.actionThrottled=Boolean(gate.actionThrottled);base.skipReason=gate.allowed?null:gate.reason;base.metaErrorCode=gate.metaErrorCode||null;base.metaErrorSubcode=gate.metaErrorSubcode||null;
    if(!gate.allowed){base.remainingQueued=queue.length;return{status:'queued',reason:gate.reason,...base,estimatedResumeAt:gate.estimatedResumeAt||gate.nextProbeAt||null,nextProbeAt:gate.nextProbeAt||null,publishingUsage:gate.publishingUsage||null,durationMs:Date.now()-start};}
    const candidate=queue.find(row=>{const next=Date.parse(row.nextPublishAttemptAt||'');return!Number.isFinite(next)||next<=now;});
    if(!candidate){base.skipReason='no_ready_item';base.remainingQueued=queue.length;return{status:'skipped',reason:'no_ready_item',...base,durationMs:Date.now()-start};}
    await prepareQueuedItemForPublish(candidate.queueId,{now});
    base.publishAttempted=1;
    const published=await publishInstagramReviewItemQueued(candidate.queueId,publishInstagramReviewItem,{now,prechecked:true,publishingUsage:gate.publishingUsage});
    base.metaCalls+=Number(published.metaCalls||0);
    if(published.status==='queued'){
      base.publishFailed=1;base.rateLimited=published.reason==='META_ACTION_THROTTLE'||base.rateLimited;base.actionThrottled=published.reason==='META_ACTION_THROTTLE'||base.actionThrottled;base.skipReason=published.reason;base.metaErrorCode=published.metaErrorCode||base.metaErrorCode;base.metaErrorSubcode=published.metaErrorSubcode||base.metaErrorSubcode;base.remainingQueued=null;
      return{status:'partial',reason:published.reason,...base,item:published.item,estimatedResumeAt:published.estimatedResumeAt,durationMs:Date.now()-start};
    }
    if(published.status==='published'){base.publishPosted=1;await clearInstagramPublishThrottle({now:Date.now()});await setJson(LAST_PUBLISH_KEY,{queueId:published.item.queueId,publishedAt:published.item.publishedAt||new Date().toISOString()});}
    base.remainingQueued=null;base.remainingReady=null;
    return{status:base.publishPosted?'partial':'skipped',reason:base.publishPosted?'safe_pacing_remaining':'publish_failed_or_stale',...base,item:published.item||null,durationMs:Date.now()-start};
  }catch(error){
    if(isMetaActionThrottle(error)){const throttle=await activateInstagramActionThrottle(error,{now:Date.now()});base.rateLimited=true;base.actionThrottled=true;base.skipReason='META_ACTION_THROTTLE';base.metaErrorCode=9;base.metaErrorSubcode=2207069;base.metaCalls+=Number(error?.metaCalls||1);base.remainingQueued=null;return{status:'partial',reason:'META_ACTION_THROTTLE',...base,estimatedResumeAt:throttle.estimatedResumeAt,nextProbeAt:throttle.nextProbeAt,durationMs:Date.now()-start};}
    base.publishFailed=base.publishAttempted?1:0;base.skipReason=String(error?.message||error).slice(0,240);base.metaCalls+=Number(error?.metaCalls||0);base.remainingQueued=null;return{status:'failed',reason:'publish_failed',...base,durationMs:Date.now()-start};
  }finally{await releaseLock(AUTO_LOCK,token).catch(()=>{})}
}
export async function kickInstagramPublisher(){return runInstagramAutoUpload({trigger:'prepare-immediate',now:Date.now()});}
export async function getInstagramAutoUploadTelemetry(){const snapshot=await getInstagramPublishQueueSnapshot({now:Date.now()});return{autoUploadEnabled:(await getInstagramAutomationSettings()).autoUploadEnabled,queue:snapshot};}
