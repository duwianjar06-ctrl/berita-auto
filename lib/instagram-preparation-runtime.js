import {readArticles} from './storage.js';
import {listJson,getJson,setJson,upsertIndexed,acquireLock,releaseLock,persistenceConfigured} from './persistence.js';
import {readSocialQueue,buildEligibleSocialQueue,scoreSocialArticle,readRecentPublished,deterministicCaption} from './social.js';
import {prepareInstagramCandidate} from './social-preparation.js';
import {repairInstagramReviewQueue} from './instagram-review-repair.js';
import {articlePath} from './article-url.js';
import {telegramConfigured,sendTelegramMessage} from './telegram.js';

const INDEX='ba:social:instagram:review:index';
const ITEM=id=>`ba:social:instagram:review:item:${id}`;
const REMOVED=id=>`ba:social:instagram:review:removed:${id}`;
const NOTIFIED=id=>`ba:social:instagram:review:notified:${id}`;
const ATTENTION=id=>`ba:social:instagram:review:attention:${id}`;
const LOCK='ba:social:instagram:prepare:lock';
const LAST_ACCEPTED='ba:social:instagram:prepare:last-accepted-at';
const MAX_ATTEMPTS=Math.max(1,Math.min(10,Number(process.env.INSTAGRAM_PREPARE_ATTEMPT_BUDGET||10)));
const READY_TARGET=Math.max(1,Math.min(3,Number(process.env.INSTAGRAM_PREPARE_READY_TARGET||2)));
const EXECUTION_BUDGET_MS=Math.max(60000,Math.min(90000,Number(process.env.INSTAGRAM_PREPARE_EXECUTION_BUDGET_MS||75000)));
const MIN_RUN_INTERVAL_MS=5*60*1000;
const MIN_CANDIDATE_RESERVE_MS=15000;
const RETRY_MINUTES=[5,15,30];
const siteUrl=()=>String(process.env.SITE_URL||'https://berita-auto.vercel.app').replace(/\/$/,'');
const isReady=row=>row?.status==='READY'&&!row?.removedAt&&!row?.postedAt&&!row?.mediaId;
const retryMs=n=>RETRY_MINUTES[Math.max(0,Math.min(RETRY_MINUTES.length-1,Number(n||1)-1))]*60000;
const recoverable=code=>code==='CANONICAL_URL_TIMEOUT'||code==='CANONICAL_URL_UNREACHABLE'||code==='CARD_UPLOAD_FAILED'||code==='CARD_PUBLIC_CHECK_FAILED'||String(code||'').startsWith('CARD_PUBLIC_');

function failureCode(result){
  if(result?.articleCheck?.failureCode)return String(result.articleCheck.failureCode).toUpperCase();
  if(result?.cardFailureCode)return String(result.cardFailureCode).toUpperCase();
  const reason=String(result?.reason||'').toUpperCase();
  if(reason==='CARD_UPLOAD_FAILED')return reason;
  if(reason==='CARD_PUBLIC_CHECK_FAILED')return reason;
  if(reason==='ARTICLE_INVALID')return 'UNKNOWN_ARTICLE_INVALID';
  return reason||'UNKNOWN';
}

function primaryBlocker(d){
  if(d.readyCreated>0)return null;
  if(d.candidateAttempted===0){
    if(d.existingEligible===0&&d.freshEligible===0)return 'NO_FRESH_ARTICLES';
    if(d.skippedBackoff>0&&d.freshEligible===0)return 'ALL_BACKOFF';
    return 'NO_ELIGIBLE_CANDIDATES';
  }
  if(d.canonicalTimeout)return 'CANONICAL_URL_TIMEOUT';
  if(d.canonical404)return 'CANONICAL_URL_404';
  if(d.cardPublicTimeout)return 'CARD_PUBLIC_TIMEOUT';
  if(d.cardPublic404)return 'CARD_PUBLIC_404';
  if(d.cardPublic5xx)return 'CARD_PUBLIC_5XX';
  if(d.cardPublicOther)return 'CARD_PUBLIC_CHECK_FAILED';
  if(d.candidateAttempted>0)return 'ALL_FAILED_VALIDATION';
  return 'UNKNOWN';
}

async function notifyReady(rows){
  if(!telegramConfigured()||!rows.length)return{sent:false,reason:'telegram_not_configured'};
  const fresh=[];
  for(const row of rows)if(!await getJson(NOTIFIED(row.queueId)))fresh.push(row);
  if(!fresh.length)return{sent:false,reason:'already_notified'};
  const text=`📸 <b>Berita Auto — Instagram Review</b>\n\n<b>${fresh.length} posting baru siap ditinjau.</b>\n\n${fresh.map((row,i)=>`${i+1}. ${String(row.title||'Berita').replace(/[<&>]/g,'')}`).join('\n')}\n\n<a href="${siteUrl()}/admin-instagram?view=ready">Buka Preview Instagram</a>`;
  try{
    const result=await sendTelegramMessage(text);
    await Promise.all(fresh.map(row=>setJson(NOTIFIED(row.queueId),{queueId:row.queueId,notifiedAt:new Date().toISOString()})));
    return{sent:true,count:fresh.length,result};
  }catch(error){return{sent:false,reason:String(error?.message||error).slice(0,240)};}
}

async function notifyAttention(row,code){
  if(!telegramConfigured()||!row)return{sent:false};
  const fingerprint=`${row.queueId}:${code}`;
  if(await getJson(ATTENTION(fingerprint)))return{sent:false,reason:'already_notified'};
  const text=`⚠️ <b>Berita Auto — Instagram</b>\n\nPosting perlu perhatian.\n\nBerita: <b>${String(row.title||'Berita').replace(/[<&>]/g,'')}</b>\nKode: <b>${code}</b>\nCanonical: ${row.canonicalUrl||'-'}\n\nAkan dicoba kembali otomatis.`;
  try{
    const result=await sendTelegramMessage(text);
    await setJson(ATTENTION(fingerprint),{fingerprint,notifiedAt:new Date().toISOString()});
    return{sent:true,result};
  }catch(error){return{sent:false,reason:String(error?.message||error).slice(0,240)};}
}

function activeReview(row,now){
  if(!row||row.removedAt)return false;
  if(['POSTED','PUBLISHING','REMOVED','READY','PREPARING'].includes(String(row.status||'').toUpperCase()))return true;
  if(['FAILED','ATTENTION'].includes(String(row.status||'').toUpperCase()))return true;
  const next=Date.parse(row.nextRetryAt||'');
  return Number.isFinite(next)&&next>now;
}

function buildFreshCandidates(articles,existing,removedIds,recentPublished,now){
  const out=[];
  for(const article of articles){
    if(!article?.id||!article?.sitePublishedAt||article.removedAt)continue;
    const id=String(article.id);
    if(removedIds.has(id))continue;
    const prior=existing.find(row=>String(row.articleId)===id);
    if(prior&&activeReview(prior,now))continue;
    out.push({article,state:'queued',articleId:id,selectionScore:scoreSocialArticle(article,{now,recentPublished})});
  }
  return out.sort((a,b)=>b.selectionScore-a.selectionScore);
}

function buildExistingCandidates(queue,existing,removedIds,recentPublished,now,diagnostics){
  const out=[];
  for(const item of buildEligibleSocialQueue(queue)){
    const article=item.article;
    if(!article?.id)continue;
    const id=String(article.id);
    const prior=existing.find(row=>String(row.articleId)===id);
    if(prior?.nextRetryAt&&Date.parse(prior.nextRetryAt)>now){diagnostics.skippedBackoff++;continue;}
    if(removedIds.has(id)||prior?.removedAt){diagnostics.skippedRemoved++;continue;}
    if(prior&&['READY','PREPARING','PUBLISHING','POSTED','REMOVED'].includes(String(prior.status||'').toUpperCase())){diagnostics.skippedDuplicate++;continue;}
    const score=scoreSocialArticle(article,{now,recentPublished});
    out.push({...item,selectionScore:score,state:'failed'});
  }
  return out.sort((a,b)=>b.selectionScore-a.selectionScore);
}

export function buildPreparationCandidatePool({articles=[],queue=[],existing=[],removedIds=new Set(),recentPublished=[],now=Date.now()}={}){
  const diagnostics={skippedBackoff:0,skippedRemoved:0,skippedDuplicate:0};
  const existingCandidates=buildExistingCandidates(queue,existing,removedIds,recentPublished,now,diagnostics);
  const freshCandidates=buildFreshCandidates(articles,existing,removedIds,recentPublished,now);
  const seen=new Set();
  const dedupe=list=>list.filter(item=>{const id=String(item?.article?.id||'');if(!id||seen.has(id))return false;seen.add(id);return true;});
  return{existingCandidates:dedupe(existingCandidates),freshCandidates:dedupe(freshCandidates),diagnostics};
}

export async function prepareInstagramProductionQueue({trigger='social-prepare',now=Date.now()}={}){
  if(!persistenceConfigured())return{status:'skipped',reason:'persistence_not_configured',metaCalls:0};
  const token=`${trigger}:${now}:${Math.random().toString(36).slice(2,8)}`;
  const lockStarted=Date.now();
  if(!(await acquireLock(LOCK,token,120)))return{status:'skipped',reason:'preparation_locked',metaCalls:0,diagnostics:{lockMs:Date.now()-lockStarted}};
  const startedAt=Date.now();
  const deadline=startedAt+EXECUTION_BUDGET_MS;
  const diagnostics={runAt:new Date(now).toISOString(),trigger,queueTotal:0,existingEligible:0,freshEligible:0,candidateAttempted:0,candidateFailed:0,candidateSucceeded:0,failedRetryAttempted:0,freshAttempted:0,attemptedArticleIds:[],failedArticleIds:[],readyArticleIds:[],skippedBackoff:0,skippedRemoved:0,skippedPosted:0,skippedPublishing:0,skippedDuplicate:0,canonicalPass:0,canonicalTimeout:0,canonical404:0,canonicalOther:0,imageValid:0,fallbackUsed:0,cardRenderPass:0,cardPersistPass:0,cardPublicPass:0,cardPublicTimeout:0,cardPublic404:0,cardPublic5xx:0,cardPublicOther:0,captionValid:0,captionFailed:0,attentionCreated:0,attentionRecovered:0,readyCreated:0,readyTotal:0,preparedCount:0,repairAttempted:0,repairStillInvalid:0,skippedBackoffRepair:0,metaCalls:0,totalMs:0,lockMs:Date.now()-lockStarted,queueReadMs:0,articleReadMs:0,repairMs:0,primaryBlocker:null,timeBudgetReached:false};
  const budgetReached=()=>Date.now()>=deadline;
  const remainingMs=()=>Math.max(0,deadline-Date.now());
  try{
    const previousRun=await getJson(LAST_ACCEPTED);
    const previousAt=Number(previousRun?.at||0);
    if(previousAt&&now-previousAt<MIN_RUN_INTERVAL_MS){
      const skipped={status:'skipped',reason:'schedule_deduped',metaCalls:0,trigger,elapsedMs:Date.now()-startedAt,nextAcceptedAt:new Date(previousAt+MIN_RUN_INTERVAL_MS).toISOString()};
      await setJson('ba:social:instagram:prepare:last-run',skipped);
      return skipped;
    }
    await setJson(LAST_ACCEPTED,{at:now,trigger});

    const queueReadStarted=Date.now();
    const existing=await listJson(INDEX);
    const queue=await readSocialQueue(100);
    diagnostics.queueReadMs=Date.now()-queueReadStarted;
    diagnostics.queueTotal=queue.length;
    const articlesReadStarted=Date.now();
    const articles=await readArticles();
    diagnostics.articleReadMs=Date.now()-articlesReadStarted;
    const recent=(await readRecentPublished(100)).map(x=>x.article||x).filter(Boolean);
    const removedIds=new Set(existing.filter(row=>row?.removedAt||String(row?.status||'').toUpperCase()==='REMOVED').map(row=>String(row.articleId)));
    for(const article of articles)if(article?.removedAt)removedIds.add(String(article.id));
    const pool=buildPreparationCandidatePool({articles,queue,existing,removedIds,recentPublished:recent,now});
    diagnostics.skippedBackoff=pool.diagnostics.skippedBackoff;
    diagnostics.skippedRemoved=pool.diagnostics.skippedRemoved;
    diagnostics.skippedDuplicate=pool.diagnostics.skippedDuplicate;
    diagnostics.existingEligible=pool.existingCandidates.length;
    diagnostics.freshEligible=pool.freshCandidates.length;

    const picked=[];
    const seen=new Set();
    const addCandidate=(item,isFresh)=>{
      const id=String(item?.article?.id||'');
      if(!id||seen.has(id))return;
      seen.add(id);
      picked.push({...item,isFresh});
    };
    for(const item of pool.freshCandidates)addCandidate(item,true);
    for(const item of pool.existingCandidates)addCandidate(item,false);
    const candidatePool=picked.slice(0,MAX_ATTEMPTS);
    const prepared=[];

    for(let i=0;i<candidatePool.length&&diagnostics.readyCreated<READY_TARGET;i++){
      if(remainingMs()<MIN_CANDIDATE_RESERVE_MS){diagnostics.timeBudgetReached=true;break;}
      const item=candidatePool[i];
      const article=item.article;
      const articleId=String(article.id);
      diagnostics.candidateAttempted++;
      if(item.isFresh)diagnostics.freshAttempted++;else diagnostics.failedRetryAttempted++;
      diagnostics.attemptedArticleIds.push(articleId);
      const queueId=`${article.id}:${article.stableId||article.id}`;
      const preparedAt=new Date().toISOString();
      const canonicalUrl=`${siteUrl()}${articlePath(article)}`;
      const base={queueId,articleId:article.id,stableId:article.stableId||article.id,title:article.title,category:article.category,publisher:article.publisher||article.sourceName||'Sumber publik',sourceUrl:article.sourceUrl||article.source||article.originalUrl||null,canonicalUrl,sourcePublishedAt:article.sourcePublishedAt||article.publishedAt||null,sitePublishedAt:article.sitePublishedAt||null,status:'PREPARING',preparedAt,priorityScore:item.selectionScore||0};
      const candidateStarted=Date.now();
      try{
        const result=await prepareInstagramCandidate(item,{siteUrl:siteUrl(),runId:`production-${now}-${i+1}`,full:true});
        const candidateMs=Date.now()-candidateStarted;
        const code=result.status==='READY'?null:failureCode(result);
        if(result.articleCheck?.valid)diagnostics.canonicalPass++;else if(code==='CANONICAL_URL_TIMEOUT')diagnostics.canonicalTimeout++;else if(code==='CANONICAL_URL_404')diagnostics.canonical404++;else if(String(code).startsWith('CANONICAL_'))diagnostics.canonicalOther++;
        if(result.image?.status==='FALLBACK_USED')diagnostics.fallbackUsed++;else diagnostics.imageValid++;
        if(result.render?.status==='RENDER_SUCCESS')diagnostics.cardRenderPass++;
        if(result.cardUrls?.length)diagnostics.cardPersistPass++;
        if(result.cardReady&&!result.cardFailureCode)diagnostics.cardPublicPass++;
        if(result.cardFailureCode==='CARD_PUBLIC_TIMEOUT')diagnostics.cardPublicTimeout++;else if(result.cardFailureCode==='CARD_PUBLIC_404')diagnostics.cardPublic404++;else if(result.cardFailureCode==='CARD_PUBLIC_5XX')diagnostics.cardPublic5xx++;else if(result.cardFailureCode)diagnostics.cardPublicOther++;
        if(result.captionStatus==='READY')diagnostics.captionValid++;else diagnostics.captionFailed++;
        const prior=existing.find(row=>String(row.articleId)===articleId);
        const attempt=Number(prior?.attemptCount||0)+1;
        const nextRetryAt=code&&recoverable(code)?new Date(now+retryMs(attempt)).toISOString():null;
        const row={...base,status:result.status==='READY'?'READY':'FAILED',preparationState:result.preparationState||result.status,readyAt:result.readyAt||null,cardUrls:result.cardUrls||[],previewUrl:result.previewUrl||result.cardUrls?.[0]||null,cardChecks:result.cardChecks||[],render:result.render||null,imageValidation:result.image||null,imageValidationStatus:result.imageValidationStatus||result.image?.status||'UNKNOWN',imageRelationship:result.imageRelationship||result.image?.status||'UNKNOWN',sourceImageUrl:result.image?.imageUrl||null,imageOriginUrl:result.image?.imageOriginUrl||null,caption:prior?.captionEdited?prior.caption:deterministicCaption(article,siteUrl()),captionOriginal:prior?.captionOriginal||deterministicCaption(article,siteUrl()),captionEdited:Boolean(prior?.captionEdited),captionEditedAt:prior?.captionEditedAt||null,captionStatus:'READY',dedupeStatus:'NOT_POSTED',failureCode:code,failureStage:result.cardFailureStage||result.articleCheck?.failureStage||null,failureMessage:code||null,attentionReason:code,lastError:code,attemptCount:result.status==='READY'?0:attempt,nextRetryAt,failedAt:result.status==='READY'?null:new Date().toISOString(),updatedAt:new Date().toISOString(),diagnostics:{candidateMs}};
        await upsertIndexed(INDEX,ITEM(queueId),row);
        prepared.push(row);
        diagnostics.preparedCount++;
        if(row.status==='READY'){
          diagnostics.readyCreated++;
          diagnostics.candidateSucceeded++;
          diagnostics.readyArticleIds.push(articleId);
        }else{
          diagnostics.candidateFailed++;
          diagnostics.failedArticleIds.push(articleId);
          diagnostics.attentionCreated++;
          await notifyAttention(row,code);
        }
      }catch(error){
        diagnostics.candidateFailed++;
        diagnostics.failedArticleIds.push(articleId);
        const candidateMs=Date.now()-candidateStarted;
        const code='STORAGE_FAILED';
        const prior=existing.find(row=>String(row.articleId)===articleId);
        const attempt=Number(prior?.attemptCount||0)+1;
        const row={...base,status:'FAILED',failureCode:code,failureStage:'PREPARATION',failureMessage:String(error?.message||error).slice(0,240),attentionReason:code,lastError:code,attemptCount:attempt,nextRetryAt:new Date(now+retryMs(attempt)).toISOString(),updatedAt:new Date().toISOString(),diagnostics:{candidateMs}};
        try{await upsertIndexed(INDEX,ITEM(queueId),row);}catch{}
        prepared.push(row);
        diagnostics.attentionCreated++;
        await notifyAttention(row,code);
      }
    }

    if(diagnostics.readyCreated<READY_TARGET&&!budgetReached()&&remainingMs()>=MIN_CANDIDATE_RESERVE_MS){
      const repairStarted=Date.now();
      try{
        const repair=await repairInstagramReviewQueue({limit:1,now});
        diagnostics.attentionRecovered=Number(repair?.recovered||0);
        diagnostics.repairAttempted=Number(repair?.attempted||0);
        diagnostics.repairStillInvalid=Number(repair?.stillInvalid||0);
        diagnostics.skippedBackoffRepair=Number(repair?.skippedBackoff||0);
      }catch(error){console.error('[instagram-prepare] repair pass failed',error);}
      diagnostics.repairMs=Date.now()-repairStarted;
    }

    const all=await listJson(INDEX);
    diagnostics.readyTotal=all.filter(isReady).length;
    diagnostics.primaryBlocker=primaryBlocker(diagnostics);
    diagnostics.totalMs=Date.now()-startedAt;
    diagnostics.timeBudgetReached=diagnostics.timeBudgetReached||budgetReached();
    const newlyReady=prepared.filter(isReady);
    const notification=await notifyReady(newlyReady);
    const status=diagnostics.timeBudgetReached?'partial':'prepared';
    const reason=diagnostics.timeBudgetReached?'time_budget_reached':undefined;
    const result={status,reason,metaCalls:0,trigger,ready:diagnostics.readyTotal,readyTotal:diagnostics.readyTotal,preparing:prepared.filter(x=>x.status==='PREPARING').length,failed:prepared.filter(x=>x.status==='FAILED').length,prepared:prepared.length,newlyReady:newlyReady.length,diagnostics,notification};
    await setJson('ba:social:instagram:prepare:last-run',result);
    return result;
  }finally{
    diagnostics.totalMs=Date.now()-startedAt;
    await releaseLock(LOCK,token).catch(()=>{});
  }
}
