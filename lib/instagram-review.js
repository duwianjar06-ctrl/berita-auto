import {readArticles} from './storage.js';
import {getJson,setJson,upsertIndexed,removeIndexed,acquireLock,releaseLock,listJson,persistenceConfigured} from './persistence.js';
import {readSocialQueue,buildEligibleSocialQueue,selectBestSocialArticle,readRecentPublished,markSocialPublished,deterministicCaption} from './social.js';
import {prepareInstagramCandidate,finalRevalidatePreparedCandidate} from './social-preparation.js';
import {instagramConfigured,getPublishingUsage,getMediaPermalink} from './instagram.js';
import {createAndPublishMedia} from '../worker/social-run.js';
import {telegramConfigured,sendTelegramMessage} from './telegram.js';

export const REVIEW_QUEUE_INDEX='ba:social:instagram:review:index';
export const PREPARE_INTERVAL_MINUTES=Math.max(1,Number(process.env.INSTAGRAM_PREPARE_INTERVAL_MINUTES||1));
export const REVIEW_MODE=String(process.env.INSTAGRAM_PUBLISH_MODE||'review').trim().toLowerCase()==='auto'?'auto':'review';
export const PREPARATION_BATCH_SIZE=Math.max(1,Math.min(5,Number(process.env.INSTAGRAM_PREPARE_BATCH_SIZE||3)));
export const REVIEW_QUEUE_TARGET=null;
const REMOVED_TTL_SECONDS=24*60*60;
const PUBLISH_LOCK_TTL_SECONDS=180;
const siteUrl=()=>String(process.env.SITE_URL||'https://berita-auto.vercel.app').replace(/\/$/,'');
const key=id=>`ba:social:instagram:review:item:${id}`;
const removedKey=id=>`ba:social:instagram:review:removed:${id}`;
const notifiedKey=id=>`ba:social:instagram:review:notified:${id}`;
const attentionKey=id=>`ba:social:instagram:review:attention:${id}`;
function isReady(row){return row?.status==='READY'&&!row?.removedAt&&!row?.postedAt&&!row?.mediaId;}
function safeTitle(row){return String(row?.title||'Berita').replace(/[<&>]/g,'');}
function classifyFailure(result){
  const reason=String(result?.reason||'').toUpperCase();
  const failures=Array.isArray(result?.articleCheck?.failures)?result.articleCheck.failures.map(String):[];
  if(reason==='ARTICLE_INVALID'){
    if(failures.includes('not_published'))return'ARTICLE_UNPUBLISHED';
    if(failures.some(x=>x.includes('source_url')))return'SOURCE_URL_FAILED';
    return'ARTICLE_INVALID';
  }
  if(reason==='CARD_UPLOAD_FAILED')return'CARD_UPLOAD_FAILED';
  if(reason==='CARD_PUBLIC_CHECK_FAILED'||reason==='CARD_VALIDATION_FAILED')return'CARD_PUBLIC_CHECK_FAILED';
  if(reason==='CAPTION_FAILED')return'CAPTION_FAILED';
  if(reason==='DUPLICATE')return'DUPLICATE';
  if(reason==='STALE')return'STALE';
  if(reason==='IMAGE_PROVENANCE_INVALID')return'IMAGE_PROVENANCE_INVALID';
  if(result?.image?.status==='FALLBACK_USED'&&reason)return'SOURCE_IMAGE_MISSING';
  return reason||'UNKNOWN';
}
async function notifyNewReady(rows){
  if(!telegramConfigured()||!rows.length)return{sent:false,reason:'telegram_not_configured'};
  const fresh=[];
  for(const row of rows)if(!await getJson(notifiedKey(row.queueId)))fresh.push(row);
  if(!fresh.length)return{sent:false,reason:'already_notified'};
  const text=`📸 <b>Berita Auto — Instagram Review</b>\n\n<b>${fresh.length} posting baru siap ditinjau.</b>\n\n${fresh.map((row,index)=>`${index+1}. ${safeTitle(row)}`).join('\n')}\n\n<a href="${siteUrl()}/admin-instagram?view=ready">Buka Preview Instagram</a>`;
  try{
    const result=await sendTelegramMessage(text);
    await Promise.all(fresh.map(row=>setJson(notifiedKey(row.queueId),{queueId:row.queueId,notifiedAt:new Date().toISOString()})));
    return{sent:true,count:fresh.length,result};
  }catch(error){return{sent:false,count:fresh.length,reason:String(error?.message||error).slice(0,240)};}
}
async function notifyAttention(row,reason){
  if(!telegramConfigured()||!row)return{sent:false,reason:'telegram_not_configured'};
  const fingerprint=`${row.queueId}:${reason}:${row.lastError||''}`;
  if(await getJson(attentionKey(fingerprint)))return{sent:false,reason:'already_notified'};
  const text=`⚠️ <b>Berita Auto — Instagram</b>\n\nAda posting yang perlu perhatian.\n\nBerita: <b>${safeTitle(row)}</b>\nMasalah: <b>${reason}</b>\n\n<a href="${siteUrl()}/admin-instagram?view=attention">Lihat Detail</a>`;
  try{const result=await sendTelegramMessage(text);await setJson(attentionKey(fingerprint),{fingerprint,notifiedAt:new Date().toISOString()});return{sent:true,result};}catch(error){return{sent:false,reason:String(error?.message||error).slice(0,240)};}
}

export async function prepareInstagramReviewQueue({trigger='qstash',now=Date.now()}={}){
  if(REVIEW_MODE!=='review')return{status:'skipped',reason:'publish_mode_auto',metaCalls:0};
  if(!persistenceConfigured())return{status:'skipped',reason:'persistence_not_configured',metaCalls:0};
  const lockToken=`${trigger}:${now}:${Math.random().toString(36).slice(2,8)}`;
  if(!(await acquireLock('ba:social:instagram:prepare:lock',lockToken,120)))return{status:'skipped',reason:'lock_busy',metaCalls:0};
  const diagnostics={runAt:new Date(now).toISOString(),trigger,itemsRead:0,candidateCount:0,eligibleCount:0,rejectedDuplicate:0,rejectedPosted:0,rejectedRemoved:0,rejectedStale:0,rejectedInvalidArticle:0,rejectedSourceUrl:0,rejectedImage:0,rejectedCard:0,rejectedCaption:0,storageFailure:0,fallbackUsed:0,preparedCount:0,readyCreated:0,attentionCreated:0,metaCalls:0};
  try{
    const existing=await listInstagramReviewQueue();
    const articles=await readArticles();
    diagnostics.itemsRead=articles.length;
    const queue=await readSocialQueue(100);
    const eligible=buildEligibleSocialQueue(queue.length?queue:articles.filter(a=>a?.id&&a?.sitePublishedAt).map(article=>({article,state:'queued'})));
    diagnostics.candidateCount=eligible.length;
    const recent=(await readRecentPublished(100)).map(item=>item.article||item).filter(Boolean);
    const ranked=[];
    for(const item of eligible.slice(0,20)){
      const article=item.article||item;
      const id=String(article?.id||item?.articleId||'');
      if(!id){diagnostics.rejectedInvalidArticle++;continue;}
      if(await getJson(`ba:social:instagram:published:${id}`)){diagnostics.rejectedPosted++;continue;}
      if(await getJson(removedKey(id))){diagnostics.rejectedRemoved++;continue;}
      const prior=existing.find(row=>String(row.articleId)===id);
      if(prior&&['READY','PREPARING','PUBLISHING','POSTED'].includes(prior.status)){diagnostics.rejectedDuplicate++;continue;}
      const selected=selectBestSocialArticle([item],{now,recentPublished:recent});
      if(!selected){diagnostics.rejectedStale++;continue;}
      ranked.push({...item,selectionScore:selected.selectionScore});
    }
    ranked.sort((a,b)=>Number(b.selectionScore||0)-Number(a.selectionScore||0));
    diagnostics.eligibleCount=ranked.length;
    const picked=ranked.slice(0,PREPARATION_BATCH_SIZE);
    const prepared=[];
    for(let i=0;i<picked.length;i++){
      const item=picked[i];
      const article=item.article||item;
      const queueId=`${article.id}:${article.stableId||article.id}`;
      const preparedAt=new Date().toISOString();
      const base={queueId,articleId:article.id,stableId:article.stableId||article.id,title:article.title,category:article.category,publisher:article.publisher||article.sourceName||'Sumber publik',sourceUrl:article.sourceUrl||article.source||article.originalUrl||null,canonicalUrl:article.canonicalUrl||`${siteUrl()}/berita/${encodeURIComponent(article.slug||article.id)}`,sourcePublishedAt:article.sourcePublishedAt||article.publishedAt||null,sitePublishedAt:article.sitePublishedAt||null,status:'PREPARING',preparedAt,priorityScore:item.selectionScore||0};
      try{await upsertIndexed(REVIEW_QUEUE_INDEX,key(queueId),base);}catch(error){diagnostics.storageFailure++;const failed={...base,status:'FAILED',attentionReason:'STORAGE_FAILED',lastError:String(error?.message||error).slice(0,240),updatedAt:new Date().toISOString()};try{await upsertIndexed(REVIEW_QUEUE_INDEX,key(queueId),failed);}catch{};prepared.push(failed);diagnostics.attentionCreated++;await notifyAttention(failed,'STORAGE_FAILED');continue;}
      diagnostics.preparedCount++;
      const result=await prepareInstagramCandidate(item,{siteUrl:siteUrl(),runId:`review-${now}-${i+1}`,full:true});
      if(result.image?.status==='FALLBACK_USED')diagnostics.fallbackUsed++;
      const failureReason=result.status==='READY'?null:classifyFailure(result);
      const row={...base,sourceImageUrl:result.image?.imageUrl||null,imageOriginUrl:result.image?.imageOriginUrl||null,imageValidation:result.image||null,imageValidationStatus:result.imageValidationStatus||result.image?.status||'UNKNOWN',imageRelationship:result.imageRelationship||result.image?.status||'UNKNOWN',cardUrls:result.cardUrls||[],previewUrl:result.previewUrl||result.cardUrls?.[0]||null,cardChecks:result.cardChecks||[],caption:deterministicCaption(article,siteUrl()),captionOriginal:deterministicCaption(article,siteUrl()),captionEdited:false,captionStatus:'READY',dedupeStatus:'NOT_POSTED',status:result.status==='READY'?'READY':'FAILED',preparationState:result.preparationState||result.status,preparedAt:result.preparedAt||preparedAt,readyAt:result.readyAt||null,render:result.render||null,font:result.font||null,glyph:result.glyph||null,lastError:result.status==='READY'?null:failureReason,attentionReason:result.status==='READY'?null:failureReason,originalFailure:result.status==='READY'?null:failureReason,updatedAt:new Date().toISOString()};
      try{await upsertIndexed(REVIEW_QUEUE_INDEX,key(queueId),row);}catch(error){diagnostics.storageFailure++;row.status='FAILED';row.attentionReason='STORAGE_FAILED';row.lastError=String(error?.message||error).slice(0,240);try{await upsertIndexed(REVIEW_QUEUE_INDEX,key(queueId),row);}catch{};prepared.push(row);diagnostics.attentionCreated++;await notifyAttention(row,'STORAGE_FAILED');continue;}
      prepared.push(row);
      if(row.status==='READY')diagnostics.readyCreated++;
      else{
        diagnostics.attentionCreated++;
        if(failureReason==='ARTICLE_UNPUBLISHED')diagnostics.rejectedInvalidArticle++;
        else if(failureReason==='SOURCE_URL_FAILED')diagnostics.rejectedSourceUrl++;
        else if(failureReason.startsWith('SOURCE_IMAGE')||failureReason==='IMAGE_PROVENANCE_INVALID')diagnostics.rejectedImage++;
        else if(failureReason.startsWith('CARD_'))diagnostics.rejectedCard++;
        else if(failureReason==='CAPTION_FAILED')diagnostics.rejectedCaption++;
        await notifyAttention(row,failureReason);
      }
    }
    const newlyReady=prepared.filter(isReady);
    const notification=await notifyNewReady(newlyReady);
    const result={status:'prepared',ready:(await listInstagramReviewQueue()).filter(isReady).length,preparing:prepared.filter(x=>x.status==='PREPARING').length,failed:prepared.filter(x=>x.status==='FAILED').length,prepared:prepared.length,newlyReady:newlyReady.length,metaCalls:0,trigger,diagnostics};
    try{await setJson('ba:social:instagram:prepare:last-run',result);}catch{}
    return result;
  }finally{await releaseLock('ba:social:instagram:prepare:lock',lockToken).catch(()=>{});}
}

export async function getInstagramReviewSnapshot(){
  const rows=await listInstagramReviewQueue();
  const ready=rows.filter(isReady);
  const lastRun=await getJson('ba:social:instagram:prepare:last-run');
  return{mode:REVIEW_MODE,prepareIntervalMinutes:PREPARE_INTERVAL_MINUTES,readyQueueTarget:null,preparationBatchSize:PREPARATION_BATCH_SIZE,items:rows,ready,counts:{ready:ready.length,preparing:rows.filter(x=>x.status==='PREPARING').length,failed:rows.filter(x=>x.status==='FAILED').length,posted:rows.filter(x=>x.status==='POSTED').length,removed:rows.filter(x=>x.status==='REMOVED').length},lastPreparation:lastRun||null,refreshedAt:new Date().toISOString()};
}

export async function editInstagramReviewCaption(queueId,caption){const row=await getJson(key(queueId));if(!row||!['READY','FAILED'].includes(row.status))throw new Error('review_item_not_editable');const value=String(caption??'').trim();if(!value)throw new Error('caption_required');const updated={...row,caption:value,captionEdited:true,captionEditedAt:new Date().toISOString(),captionStatus:'READY',updatedAt:new Date().toISOString()};await setJson(key(queueId),updated);return updated;}
export async function removeInstagramReviewItem(queueId){const row=await getJson(key(queueId));if(!row)throw new Error('review_item_not_found');const updated={...row,status:'REMOVED',removedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await setJson(key(queueId),updated);await setJson(removedKey(row.articleId),{articleId:row.articleId,removedAt:updated.removedAt,expiresAt:new Date(Date.now()+REMOVED_TTL_SECONDS*1000).toISOString()});await removeIndexed(REVIEW_QUEUE_INDEX,key(queueId));return updated;}

export async function publishInstagramReviewItem(queueId,{idempotencyKey}={}){
  if(REVIEW_MODE!=='review')throw new Error('review_mode_not_enabled');
  if(!instagramConfigured())throw new Error('instagram_not_configured');
  const row=await getJson(key(queueId));
  if(!row||!isReady(row))throw new Error('review_item_not_ready');
  const lockKey=`ba:social:instagram:publish:${queueId}`;
  const token=`${idempotencyKey||Date.now()}:${Math.random().toString(36).slice(2,8)}`;
  if(!(await acquireLock(lockKey,token,PUBLISH_LOCK_TTL_SECONDS)))throw new Error('publish_already_in_progress');
  try{
    const current=await getJson(key(queueId));
    if(!current||!isReady(current))throw new Error('review_item_not_ready');
    const article=(await readArticles()).find(item=>String(item.id)===String(current.articleId));
    if(!article)throw new Error('article_not_found');
    const final=await finalRevalidatePreparedCandidate({...current,article},{siteUrl:siteUrl(),now:Date.now()});
    if(!final.valid)throw new Error(`final_validation_failed:${final.reason}`);
    const usage=await getPublishingUsage();
    if(usage?.available===false){await setJson(key(queueId),{...current,lastError:'META_LIMITED',updatedAt:new Date().toISOString()});throw new Error('META_LIMITED');}
    const publishing={...current,status:'PUBLISHING',publishingStartedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    await setJson(key(queueId),publishing);
    const result=await createAndPublishMedia(article,publishing.caption||publishing.captionOriginal||'',publishing.cardUrls);
    if(!result.ready?.ready){await setJson(key(queueId),{...publishing,status:'FAILED',lastError:'META_CONTAINER_NOT_READY',retryable:true,updatedAt:new Date().toISOString()});throw new Error('META_CONTAINER_NOT_READY');}
    const mediaId=result.mediaId;
    let permalink=null;try{permalink=await getMediaPermalink(mediaId);}catch{}
    const publishedAt=new Date().toISOString();
    let record=null;
    for(let attempt=1;attempt<=3;attempt++)try{record=await markSocialPublished({...publishing,article},{mediaId,mediaUrl:permalink,publishedAt,publishMode:result.publishMode||(result.carousel?'carousel':'single-image')});break;}catch(error){if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*attempt));}
    if(!record)throw new Error('history_persistence_failed');
    const posted={...publishing,status:'POSTED',mediaId,permalink,publishedAt,publishMode:result.publishMode||(result.carousel?'carousel':'single-image'),containerId:result.containerId||null,childContainerIds:result.childIds||[],fallbackFromCarousel:Boolean(result.fallbackFromCarousel),postedAt,historyPersisted:true,updatedAt:new Date().toISOString()};
    await setJson(key(queueId),posted);
    return posted;
  }catch(error){
    const current=await getJson(key(queueId));
    const limited=Number(error?.metaCode||0)===9&&Number(error?.metaSubcode||0)===2207042;
    if(current&&current.status==='PUBLISHING')await setJson(key(queueId),{...current,status:limited?'READY':'FAILED',lastError:limited?'META_LIMITED':String(error?.message||error).slice(0,240),updatedAt:new Date().toISOString()});
    throw error;
  }finally{await releaseLock(lockKey,token).catch(()=>{});}
}
