import {getJson} from './persistence.js';
import {getAdminInstagramStatus} from './admin-instagram.js';
import {getInstagramReviewSnapshot} from './instagram-review.js';
import {getInstagramPublishQueueSnapshot} from './instagram-publish-queue.js';
import {getInstagramAutomationSettings} from './instagram-automation.js';
const ACTIVE_KEY='ba:social:instagram:prepare:active';
const TTL_MS=Math.max(10000,Math.min(20000,Number(process.env.INSTAGRAM_ADMIN_SNAPSHOT_TTL_MS||15000)));
let cacheValue=null;let cacheExpiresAt=0;let inFlight=null;
const detail=error=>({code:String(error?.code||'PERSISTENCE_ERROR'),operation:String(error?.operation||'instagram_admin_snapshot'),stage:String(error?.stage||'read'),status:error?.status??null,message:String(error?.message||error).slice(0,240)});
function activeValue(value){return value&&Number(value.expiresAt||0)>Date.now()?value:null}
const emptyReview=()=>({mode:'review',items:[],ready:[],counts:{ready:0,preparing:0,failed:0,posted:0,removed:0},lastPreparation:null,refreshedAt:new Date().toISOString()});
const emptyPublishQueue=()=>({items:[],counts:{queued:0,waitingMeta:0},throttle:{active:false},publishingUsage:null,refreshedAt:new Date().toISOString()});
export function composeInstagramAdminSnapshot({status,active,review,automation,publishQueue}){const base=status&&typeof status==='object'?status:{};const reviewValue=review&&Array.isArray(review.items)&&Array.isArray(review.ready)&&review.counts?review:emptyReview();const queueValue=publishQueue&&Array.isArray(publishQueue.items)&&publishQueue.counts?publishQueue:emptyPublishQueue();return{...base,automation:{...(base.automation||{}),...(automation||{})},review:reviewValue,publishQueue:queueValue,preparation:{active:activeValue(active),lastRun:reviewValue.lastPreparation||base?.latestRun||null}}}
function fallback(error){const d=detail(error);return{refreshedAt:new Date().toISOString(),persistence:{configured:true},automation:{status:'DEGRADED',credentials:'UNKNOWN',autoUploadEnabled:false,source:'unavailable'},review:emptyReview(),publishQueue:emptyPublishQueue(),posts:[],runs:[],counts:{runs:0,posts:0,queue:0,ready:0,retry:0,success:0,failed:0,cooldown:0,skipped:0},persistenceErrors:{snapshot:d},safe:{secretsExposed:false},preparation:{active:null,lastRun:null}}}
export async function getInstagramAdminSnapshot({forceRefresh=false}={}){const now=Date.now();if(!forceRefresh&&cacheValue&&cacheExpiresAt>now)return cacheValue;if(!forceRefresh&&inFlight)return inFlight;inFlight=(async()=>{try{const[status,active,review,automation,publishQueue]=await Promise.all([getAdminInstagramStatus(),getJson(ACTIVE_KEY),getInstagramReviewSnapshot(),getInstagramAutomationSettings(),getInstagramPublishQueueSnapshot({now:Date.now()})]);const value=composeInstagramAdminSnapshot({status,active,review,automation,publishQueue});cacheValue=value;cacheExpiresAt=Date.now()+TTL_MS;return value}catch(error){const value=fallback(error);cacheValue=value;cacheExpiresAt=Date.now()+Math.min(5000,TTL_MS);console.error('[instagram-admin-snapshot]',JSON.stringify(value.persistenceErrors.snapshot));return value}})();try{return await inFlight}finally{inFlight=null}}
export function invalidateInstagramAdminSnapshot(){cacheValue=null;cacheExpiresAt=0}
export const instagramAdminSnapshotTtlMs=TTL_MS;
