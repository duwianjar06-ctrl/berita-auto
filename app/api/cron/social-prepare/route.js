import {NextResponse} from 'next/server';
import {listJson,getJson,setJson,withPersistenceSource} from '../../../../lib/persistence.js';
import {classifyUpstashQuotaError,qstashDeliveryInfo,qstashNonRetryableResponse} from '../../../../lib/upstash-quota.js';
import {invalidateInstagramAdminSnapshot} from '../../../../lib/instagram-admin-snapshot.js';
import {cleanupLegacyInstagramBatch} from '../../../../lib/instagram-review-cleanup.js';
import {SOCIAL_CARD_DESIGN_VERSION} from '../../../../lib/social-card-renderer.js';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const CUTOVER_MARKER=`ba:social:instagram:design-cutover:${SOCIAL_CARD_DESIGN_VERSION}`;
const REVIEW_INDEX='ba:social:instagram:review:index';
const READY_HIGH=5;
const READY_LOW=2;
const MAX_PREPARE_PER_CYCLE=3;

function authorized(r){const s=process.env.CRON_SECRET||'';return Boolean(s&&(r.headers.get('authorization')||'')===`Bearer ${s}`)}

function countReady(rows){return rows.filter(row=>row?.status==='READY'&&!row?.removedAt&&!row?.postedAt&&!row?.mediaId).length}

function countQueuedDiagnostics(rows){return rows.filter(row=>{
  const status=String(row?.status||'').toUpperCase();
  return !row?.removedAt&&!row?.postedAt&&!row?.mediaId&&!['PUBLISHED','POSTED','REMOVED'].includes(status);
}).length}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});
  const delivery=qstashDeliveryInfo(request);
  console.log('[qstash-delivery]',JSON.stringify({route:'/api/cron/social-prepare',...delivery}));
  if(delivery.retried>0){
    console.log('[qstash-delivery-skip]',JSON.stringify({route:'/api/cron/social-prepare',scheduleId:delivery.scheduleId,messageId:delivery.messageId,retried:delivery.retried,reason:'qstash_retry_ignored_periodic_job'}));
    return NextResponse.json({status:'skipped',reason:'qstash_retry_ignored_periodic_job',delivery:delivery.delivery},{status:200,headers:{'Cache-Control':'no-store'}})
  }
  try{
    const merged=await withPersistenceSource('social-prepare',async()=>{
      let cleanup={status:'already_cutover',designVersion:SOCIAL_CARD_DESIGN_VERSION};
      if(!(await getJson(CUTOVER_MARKER))){
        const cutoverAt=new Date().toISOString();
        const result=await cleanupLegacyInstagramBatch({cutoverAt,dryRun:false,removedBy:'design-cutover',designVersion:SOCIAL_CARD_DESIGN_VERSION});
        await setJson(CUTOVER_MARKER,{designVersion:SOCIAL_CARD_DESIGN_VERSION,cutoverAt,removed:result.removed,candidates:result.candidates});
        cleanup={status:'completed',...result}
      }

      const startedAt=Date.now();
      const reviewRows=await listJson(REVIEW_INDEX);
      const readyCount=countReady(reviewRows);
      const queuedCount=countQueuedDiagnostics(reviewRows);

      if(readyCount>READY_LOW){
        const skipped={
          status:'skipped',
          reason:'ready_buffer_full',
          trigger:'social-prepare',
          metaCalls:0,
          autoPublishTriggered:false,
          autoPublish:null,
          legacyCleanup:cleanup,
          autoUploadEnabled:null,
          queuedCount,
          readyCount,
          bufferHigh:READY_HIGH,
          bufferLow:READY_LOW,
          prepareNeeded:0,
          prepared:0,
          cardRenders:0,
          durationMs:Date.now()-startedAt,
          diagnostics:{queuedCount,readyCount,bufferHigh:READY_HIGH,bufferLow:READY_LOW,prepareNeeded:0,prepared:0,cardRenders:0,metaCalls:0,redisReads:1,redisWrites:0}
        };
        console.log('[instagram-prepare]',JSON.stringify(skipped));
        return skipped;
      }

      // Refill is intentionally bounded. The runtime's candidate loop is configured
      // to prepare at most three items, which takes READY from <=2 toward the high-water mark.
      // Import lazily so the runtime's preparation budget is configured before evaluation.
      process.env.INSTAGRAM_PREPARE_READY_TARGET=String(MAX_PREPARE_PER_CYCLE);
      // Review/attention Telegram messages are intentionally disabled for this scheduler.
      // Critical Telegram alerts use separate routes and are unaffected.
      const telegramToken=process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId=process.env.TELEGRAM_CHAT_ID;
      process.env.TELEGRAM_BOT_TOKEN='';
      process.env.TELEGRAM_CHAT_ID='';
      try{
        const {prepareInstagramProductionQueue}=await import('../../../../lib/instagram-preparation-runtime.js');
        const prepareNeeded=Math.min(READY_HIGH-readyCount,MAX_PREPARE_PER_CYCLE);
        const result=await prepareInstagramProductionQueue({trigger:'social-prepare',now:Date.now()});
        return {
          ...result,
          legacyCleanup:cleanup,
          autoUploadEnabled:null,
          autoPublishTriggered:false,
          autoPublish:null,
          queuedCount,
          readyBefore:readyCount,
          bufferHigh:READY_HIGH,
          bufferLow:READY_LOW,
          prepareNeeded,
          prepared:Math.min(Number(result?.prepared||0),MAX_PREPARE_PER_CYCLE),
          cardRenders:Number(result?.diagnostics?.cardRenderPass||0),
          metaCalls:0,
          durationMs:Number(result?.diagnostics?.totalMs||0)
        };
      }finally{
        process.env.TELEGRAM_BOT_TOKEN=telegramToken;
        process.env.TELEGRAM_CHAT_ID=telegramChatId;
      }
    });
    invalidateInstagramAdminSnapshot();
    console.log('[instagram-prepare]',JSON.stringify(merged));
    return NextResponse.json(merged,{status:200,headers:{'Cache-Control':'no-store'}})
  }catch(error){
    invalidateInstagramAdminSnapshot();
    console.error('[instagram-prepare] failed',error);
    const quotaCode=classifyUpstashQuotaError(error);
    if(quotaCode)return qstashNonRetryableResponse({ok:false,code:quotaCode,retryable:false,route:'/api/cron/social-prepare',delivery:delivery.delivery,message:'Upstash request quota is exhausted; this delivery is non-retryable.'});
    return NextResponse.json({status:'failed',error:String(error?.message||error).slice(0,240)},{status:503,headers:{'Cache-Control':'no-store'}})
  }
}

export async function POST(request){return GET(request)}
