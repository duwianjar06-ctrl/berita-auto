import {getJson,setJson,sortedAdd,sortedRange,sortedRemove,delKey} from './persistence.js';

export const SOCIAL_RUN_INDEX='ba:social:instagram:runs';
const RETENTION=100;
export const VALID_STAGES=new Set(['QUEUED','TRIGGER_RECEIVED','VALIDATING','CHECKING_COOLDOWN','COOLDOWN','SELECTING_CANDIDATE','NO_CANDIDATE','DOWNLOADING_IMAGE','SOCIAL_CARD_RENDER','CARD_PERSIST','RENDERING','RENDERED','CREATING_CONTAINER','META_CONTAINER_CREATE','META_CONTAINER_STATUS','WAITING_CONTAINER','PUBLISHING','META_PUBLISH','SUCCESS','RETRY_SCHEDULED','FAILED','SKIPPED_DUPLICATE']);

function safeError(value){if(!value)return null;return String(value.message||value).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/access[_-]?token[=:\s]+[^\s&]+/gi,'access_token=[redacted]').replace(/authorization[=:\s]+[^\s&]+/gi,'Authorization=[redacted]').replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi,'$1?[redacted]').slice(0,300);}

export function renderStateForRun(result={},item=null){
  if(result?.render?.status==='RENDER_SUCCESS'||result?.render?.status==='PASS')return'RENDER_SUCCESS';
  if(result?.render?.status==='RENDER_FAILED'||result?.render?.status==='FAIL')return'RENDER_FAILED';
  if(result?.reason==='cooldown')return'COOLDOWN';
  if(['daily_limit','meta_limit_buffer','lock_busy','queue_empty','no_worthy_content','already_published'].includes(result?.reason))return'NOT_REQUIRED';
  if(item?.render?.status==='RENDER_SUCCESS'||item?.render?.status==='PASS')return'RENDER_SUCCESS';
  if(item?.cardUrls?.length)return'RENDER_SUCCESS';
  if(result?.status==='published'||result?.status==='persist_error')return'RENDER_SUCCESS';
  if(result?.status==='failed'||result?.status==='retry')return'RENDER_FAILED';
  return'UNKNOWN_LEGACY';
}

export function stageForRun(result={},item=null){
  const reason=result?.reason;const status=result?.status;const failureStage=result?.failureStage||item?.failureStage;
  if(reason==='cooldown')return'COOLDOWN';
  if(reason==='already_published')return'SKIPPED_DUPLICATE';
  if(['queue_empty','no_worthy_content','daily_limit','meta_limit_buffer'].includes(reason))return'NO_CANDIDATE';
  if(reason==='lock_busy')return'QUEUED';
  if(failureStage)return normalizeFailureStage(failureStage);
  if(status==='published'||status==='persist_error')return'SUCCESS';
  if(status==='retry'||status==='failed')return status==='retry'?'RETRY_SCHEDULED':'FAILED';
  if(result?.stage&&VALID_STAGES.has(result.stage))return result.stage;
  if(item?.currentStage&&VALID_STAGES.has(item.currentStage))return item.currentStage;
  if(item?.state==='processing')return'PUBLISHING';
  return'UNKNOWN_LEGACY';
}

export function normalizeFailureStage(value){
  const key=String(value||'').toUpperCase();
  const map={CREATE_IMAGE:'META_CONTAINER_CREATE',CREATE_CAROUSEL_CHILD:'META_CONTAINER_CREATE',CREATE_CAROUSEL_PARENT:'META_CONTAINER_CREATE',CONTAINER_CREATE:'META_CONTAINER_CREATE',POLL_CONTAINER:'META_CONTAINER_STATUS',CONTAINER_STATUS:'META_CONTAINER_STATUS',PUBLISH_MEDIA:'META_PUBLISH',PUBLISH:'META_PUBLISH',PUBLISHING:'META_PUBLISH',SOCIAL_CARD_RENDER:'SOCIAL_CARD_RENDER',CARD_PERSIST:'CARD_PERSIST'};
  return map[key]||map[key.replace(/^META_/,'')]||key||'UNKNOWN';
}

export function normalizeSchedulerStatus({vercelCron=false,qstashUsed=false,githubUsed=false}={}){return{vercelCron:vercelCron?'ACTIVE':'NOT_CONFIGURED',qstash:qstashUsed?'ACTIVE':'NOT_USED',githubActions:githubUsed?'ACTIVE':'NOT_USED'};}
export function mediaIdMessage(run={}){if(run.mediaId)return String(run.mediaId);if(run.status==='SUCCESS'||run.status==='published'||run.status==='persist_error')return'⚠️ Publish dilaporkan berhasil tetapi Media ID tidak tercatat';if(run.stage==='COOLDOWN'||run.reason==='cooldown')return'Belum tersedia — belum melakukan publish';if(run.failureStage||run.stage==='META_PUBLISH'||run.stage==='PUBLISHING'||run.reason?.includes('publish'))return'Belum tersedia — publish gagal';return'Belum tersedia — proses belum sampai tahap publish';}
export function errorState(run={}){if(run.error)return{state:'ERROR',label:'❌ Error'};if(run.warning)return{state:'WARNING',label:'⚠️ Ada peringatan'};if(['retry','failed'].includes(String(run.status||'').toLowerCase())||run.reason&&/timeout|failed|error|invalid|denied|rate_limited/i.test(String(run.reason)))return{state:'ERROR',label:'❌ Error'};return{state:'NO_ERROR',label:'✅ Tidak ada error'};}
export function statusLabel(status){const labels={SUCCESS:'Berhasil',RETRY_SCHEDULED:'Retry dijadwalkan',COOLDOWN:'Cooldown',QUEUED:'Menunggu diproses',PROCESSING:'Sedang diproses',FAILED:'Gagal',SKIPPED_DUPLICATE:'Dilewati — duplicate',NO_CANDIDATE:'Tidak ada kandidat',UNKNOWN_LEGACY:'Data lama — telemetry tidak tersedia',META_CONTAINER_CREATE:'Pembuatan container Instagram',META_CONTAINER_STATUS:'Pengecekan status container',META_PUBLISH:'Publish Instagram',CARD_PERSIST:'Menyimpan social card',SOCIAL_CARD_RENDER:'Render social card'};return labels[status]||status||'Data lama — telemetry tidak tersedia';}
export function classifyRetry({status=0,reason='',retryable}={}){if(typeof retryable==='boolean')return retryable;const code=Number(status)||0;if(code===429||code>=500||code===408)return true;if(/timeout|network|rate.?limit|temporary|processing_pending/i.test(String(reason)))return true;if(/auth|permission|invalid_media|4\d\d/i.test(String(reason)))return false;return false;}

export async function recordSocialRun({triggerSource='unknown',startedAt,finishedAt,result,error=null}={}){
  const finished=finishedAt||new Date().toISOString();const started=startedAt||finished;const articleId=result?.articleId||null;const item=articleId?await getJson(`ba:social:instagram:item:${articleId}`):null;const stage=stageForRun(result,item);const renderStatus=renderStateForRun(result,item);const runId=`instagram-${Date.parse(finished)||Date.now()}-${Math.random().toString(36).slice(2,8)}`;const safeResultError=safeError(error)||safeError(result?.error);const failureStage=normalizeFailureStage(result?.failureStage||error?.instagramOperation||item?.failureStage);const httpStatus=Number(result?.httpStatus||error?.status||0)||null;const metaCode=Number(result?.metaCode||error?.metaCode||0)||null;const retryable=classifyRetry({status:httpStatus,reason:result?.reason||'',retryable:result?.retryable});const render=result?.render||item?.render||null;
  const row={runId,triggerSource,status:result?.status||'failed',stage,reason:result?.reason||null,articleId,startedAt:started,finishedAt:finished,durationMs:Math.max(0,Date.parse(finished)-Date.parse(started)),queueReadMs:Number(result?.perf?.queueReadMs||result?.queueReadMs)||0,metaLimitMs:Number(result?.perf?.metaLimitMs||result?.metaLimitMs)||0,perf:result?.perf||null,mediaId:result?.mediaId?String(result.mediaId):null,publishedAt:result?.publishedAt||null,containerId:item?.containerId||result?.containerId||null,childContainerIds:Array.isArray(item?.childContainerIds)?item.childContainerIds:[],cardUrls:Array.isArray(item?.cardUrls)?item.cardUrls:Array.isArray(result?.cardUrls)?result.cardUrls:[],previewUrl:item?.previewUrl||result?.previewUrl||(Array.isArray(item?.cardUrls)?item.cardUrls[0]:null)||(Array.isArray(result?.cardUrls)?result.cardUrls[0]:null),sourceCardUrls:Array.isArray(item?.sourceCardUrls)?item.sourceCardUrls:[],render:render?{status:renderStatus,completedAt:render.completedAt||null,width:Number(render.width||1080),height:Number(render.height||1350),format:render.format||'jpeg',bytes:Number(render.bytes||0)||null,durationMs:Number(render.durationMs||0)||null,slideCount:Number(render.slideCount||item?.cardUrls?.length||1),renderMode:render.renderMode||'primary'}:{status:renderStatus,width:1080,height:1350,format:'jpeg',bytes:null,durationMs:null},font:result?.font||item?.font||null,glyph:result?.glyph||item?.glyph||null,failureStage:failureStage&&failureStage!=='UNKNOWN'?failureStage:null,httpStatus,metaCode,retryable,attempt:Number(item?.attempts||result?.attempt||0)||null,nextRetryAt:item?.nextRetryAt||result?.nextRetryAt||null,error:safeResultError||(result?.status==='retry'||result?.status==='failed'?String(result?.reason||'').slice(0,300):null),warning:result?.warning||null,currentStage:item?.currentStage||stage};
  await setJson(`ba:social:instagram:run:${runId}`,row);await sortedAdd(SOCIAL_RUN_INDEX,Date.parse(finished)||Date.now(),`ba:social:instagram:run:${runId}`);const keys=await sortedRange(SOCIAL_RUN_INDEX,RETENTION,RETENTION+50);for(const key of keys){await sortedRemove(SOCIAL_RUN_INDEX,key);await delKey(key);}return row;
}

export async function readSocialRuns(limit=100){const keys=await sortedRange(SOCIAL_RUN_INDEX,0,Math.max(0,limit-1));const rows=await Promise.all(keys.map(key=>getJson(key)));return rows.filter(Boolean);}
