import {getJson,setJson,sortedAdd,sortedRange,sortedRemove,delKey} from './persistence.js';
export const SOCIAL_RUN_INDEX='ba:social:instagram:runs';
const RETENTION=100;
export async function recordSocialRun({triggerSource='unknown',startedAt,finishedAt,result,error=null}={}){
  const finished=finishedAt||new Date().toISOString();
  const started=startedAt||finished;
  const runId=`instagram-${Date.parse(finished)||Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const row={runId,triggerSource,status:result?.status||'failed',reason:result?.reason||null,articleId:result?.articleId||null,startedAt:started,finishedAt:finished,durationMs:Math.max(0,Date.parse(finished)-Date.parse(started)),queueReadMs:Number(result?.queueReadMs)||0,metaLimitMs:Number(result?.metaLimitMs)||0,perf:result?.perf||null,mediaId:result?.mediaId?String(result.mediaId):null,publishedAt:result?.publishedAt||null,error:error?String(error.message||error).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,240):null};
  await setJson(`ba:social:instagram:run:${runId}`,row);
  await sortedAdd(SOCIAL_RUN_INDEX,Date.parse(finished)||Date.now(),`ba:social:instagram:run:${runId}`);
  const keys=await sortedRange(SOCIAL_RUN_INDEX,RETENTION,RETENTION+50);
  for(const key of keys){await sortedRemove(SOCIAL_RUN_INDEX,key);await delKey(key);}
  return row;
}
export async function readSocialRuns(limit=50){const keys=await sortedRange(SOCIAL_RUN_INDEX,0,Math.max(0,limit-1));const rows=await Promise.all(keys.map(key=>getJson(key)));return rows.filter(Boolean);}
