import {getJson,setJson} from './persistence.js';

export const INSTAGRAM_PUBLISHER_EVENTS_KEY='ba:social:instagram:publisher-events:v1';
export const INSTAGRAM_PUBLISHER_EVENTS_LIMIT=200;

function safe(value,max=300){return value==null?null:String(value).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,max)}

export async function recordInstagramPublisherEvent(event={}){
  const row={timestamp:event.timestamp||new Date().toISOString(),runId:safe(event.runId,120),queueId:safe(event.queueId,160),articleId:safe(event.articleId,160),title:safe(event.title,180),attempt:Number.isFinite(Number(event.attempt))?Number(event.attempt):null,stage:safe(event.stage,100)||'RUN',operation:safe(event.operation,120),status:safe(event.status,40)||'INFO',reason:safe(event.reason,180),httpStatus:Number(event.httpStatus)||null,metaCode:Number(event.metaCode)||null,metaSubcode:Number(event.metaSubcode)||null,durationMs:Number(event.durationMs)||null};
  const current=await getJson(INSTAGRAM_PUBLISHER_EVENTS_KEY);const next=[...(Array.isArray(current)?current:[]),row].slice(-INSTAGRAM_PUBLISHER_EVENTS_LIMIT);await setJson(INSTAGRAM_PUBLISHER_EVENTS_KEY,next);return row;
}
export async function readInstagramPublisherEvents(limit=10){const rows=await getJson(INSTAGRAM_PUBLISHER_EVENTS_KEY);return(Array.isArray(rows)?rows:[]).slice(-Math.max(1,Math.min(INSTAGRAM_PUBLISHER_EVENTS_LIMIT,Number(limit)||10))).reverse();}
