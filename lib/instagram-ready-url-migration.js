import {siteUrl} from './site-url.js';
import {listJson,upsertIndexed} from './persistence.js';

export const LEGACY='https://berita-auto.vercel.app';
export const REVIEW_QUEUE_INDEX='ba:social:instagram:review:index';
const FIELDS=['canonicalUrl','articleUrl','previewUrl','caption','captionBody','captionOriginal'];
export const reviewItemKey=queueId=>`ba:social:instagram:review:item:${queueId}`;
const replaceValue=value=>typeof value==='string'?value.split(LEGACY).join(siteUrl()):value;
const repairField=value=>Array.isArray(value)?value.map(repairField):replaceValue(value);
export function isMigratableReady(item={}){return String(item.status||'').toUpperCase()==='READY'&&!item.postedAt&&!item.mediaId&&!item.removedAt}
export function repairReadyInstagramItem(item={}){if(!isMigratableReady(item))return{changed:false,item};if(!item.queueId)return{changed:false,item,failed:true,reason:'queue_id_missing'};let changed=false;const next={...item};for(const field of FIELDS){const before=next[field];const after=repairField(before);if(JSON.stringify(before)!==JSON.stringify(after)){next[field]=after;changed=true}}if(Array.isArray(next.cardUrls)){const after=next.cardUrls.map(repairField);if(JSON.stringify(next.cardUrls)!==JSON.stringify(after)){next.cardUrls=after;changed=true}}return{changed,item:next,failed:false}}
export function migrateReadyInstagramItems(items=[],{dryRun=true}={}){const result={scanned:0,wouldRepair:0,repaired:0,unchanged:0,failed:0,sampleIds:[]};const output=[];for(const item of items){if(!isMigratableReady(item))continue;result.scanned++;try{const repaired=repairReadyInstagramItem(item);if(repaired.failed){result.failed++;continue}if(repaired.changed){result.wouldRepair++;if(result.sampleIds.length<10)result.sampleIds.push(String(item.id||item.articleId||item.queueId||''));if(!dryRun)result.repaired++}else result.unchanged++;output.push(repaired.item)}catch{result.failed++}}return{...result,items:output}}
export async function auditReadyInstagramUrls(){const rows=await listJson(REVIEW_QUEUE_INDEX);const result=migrateReadyInstagramItems(rows,{dryRun:true});return{...result,siteUrl:siteUrl()}}
export async function migrateReadyInstagramReviewUrls({dryRun=true}={}){const rows=await listJson(REVIEW_QUEUE_INDEX);const result=migrateReadyInstagramItems(rows,{dryRun});if(dryRun)return{...result,siteUrl:siteUrl()};let repaired=0,failed=result.failed;for(const item of result.items){const original=rows.find(row=>String(row?.queueId||'')===String(item?.queueId||''));if(!original||JSON.stringify(original)===JSON.stringify(item))continue;try{await upsertIndexed(REVIEW_QUEUE_INDEX,reviewItemKey(item.queueId),item);repaired++}catch{failed++}}return{scanned:result.scanned,repaired,unchanged:result.unchanged,failed,siteUrl:siteUrl()}}
