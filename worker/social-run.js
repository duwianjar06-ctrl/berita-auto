import {readArticles} from '../lib/storage.js';
import {persistenceConfigured,acquireLock,releaseLock,getJson} from '../lib/persistence.js';
import {instagramConfigured,instagramConfig,createMediaContainer,pollContainerReady,publishMediaContainer,getPublishingUsage,classifyInstagramError} from '../lib/instagram.js';
import {SOCIAL_LOCK_KEY,SOCIAL_LOCK_TTL,socialConfig,shouldSkipCooldown,shouldSkipDailyLimit,shouldSkipMetaBuffer,queueSocialArticle,readSocialQueue,readRecentPublished,selectBestSocialArticle,deterministicCaption,getDailyPublishedCount,getLastPublishedAt,markSocialProcessing,markSocialFailure,markSocialPublished,incrementDailyPublishedCount} from '../lib/social.js';

async function validatePublicImage(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch(url,{method:'GET',headers:{Range:'bytes=0-64'},signal:controller.signal,cache:'no-store',redirect:'follow'});const type=String(response.headers.get('content-type')||'').toLowerCase();if(!response.ok||!type.startsWith('image/'))throw new Error(`social_card_invalid_response_${response.status}_${type||'missing_content_type'}`);return true;}catch(error){throw Object.assign(new Error(String(error?.message||error).slice(0,200)),{kind:'permanent'});}finally{clearTimeout(timer);}}
function retryDelay(attempts){return Math.min(30*60*1000,Math.max(60*1000,2**Math.min(attempts,5)*60*1000));}

export async function runSocialCycle({trigger='manual',now=Date.now()}={}){
  if(!instagramConfig().enabled)return{status:'skipped',reason:'disabled'};
  if(!instagramConfigured())return{status:'skipped',reason:'missing_configuration'};
  if(!persistenceConfigured())return{status:'skipped',reason:'persistence_not_configured'};
  const lockToken=`${trigger}:${process.pid}:${now}`;
  if(!(await acquireLock(SOCIAL_LOCK_KEY,lockToken,SOCIAL_LOCK_TTL))){console.log('[social] skipped reason=lock_busy');return{status:'skipped',reason:'lock_busy'}}
  try{
    const cfg=socialConfig();const articles=await readArticles();
    for(const article of articles.slice(0,100)){if(article?.id&&article?.sitePublishedAt)await queueSocialArticle(article).catch(error=>console.warn(`[social] queue_reconcile_failed articleId=${article.id} reason=${String(error?.message||error).slice(0,120)}`));}
    const queue=await readSocialQueue(100);const eligible=queue.filter(item=>{const article=articles.find(a=>a.id===item.articleId);return article&&article.sitePublishedAt&&item.state!=='published';}).map(item=>({...item,article:articles.find(a=>a.id===item.articleId)}));
    if(!eligible.length){console.log('[social] skipped reason=queue_empty');return{status:'skipped',reason:'queue_empty'}}
    const recent=await readRecentPublished(20);const last=await getLastPublishedAt();
    if(shouldSkipCooldown(last,now,cfg.minIntervalMinutes)){console.log('[social] skipped reason=cooldown');return{status:'skipped',reason:'cooldown'}}
    const daily=await getDailyPublishedCount(now);if(shouldSkipDailyLimit(daily,cfg.maxPostsPerDay)){console.log('[social] skipped reason=daily_limit');return{status:'skipped',reason:'daily_limit',publishedToday:daily}}
    const usage=await getPublishingUsage();if(shouldSkipMetaBuffer(usage,cfg.limitBuffer)){console.log('[social] skipped reason=meta_limit_buffer');return{status:'skipped',reason:'meta_limit_buffer',remaining:usage.remaining}}
    const selected=selectBestSocialArticle(eligible,{now,recentPublished:recent});if(!selected){console.log('[social] skipped reason=no_worthy_content');return{status:'skipped',reason:'no_worthy_content'}}
    const publishedState=await getJson(`ba:social:instagram:published:${selected.articleId}`);if(publishedState){console.log(`[social] skipped reason=already_published articleId=${selected.articleId}`);return{status:'skipped',reason:'already_published'}}
    const processing=await markSocialProcessing(selected);const article=selected.article;console.log(`[social] selected articleId=${article.id} score=${selected.selectionScore}`);
    try{
      const caption=deterministicCaption(article,instagramConfig().siteUrl);const imageUrl=`${instagramConfig().siteUrl}/api/social-card/${encodeURIComponent(article.id)}`;await validatePublicImage(imageUrl);
      const containerId=await createMediaContainer({imageUrl,caption});const ready=await pollContainerReady(containerId);
      if(!ready.ready){const err=ready.permanent?new Error('instagram_media_processing_failed'):new Error('instagram_media_processing_pending');if(ready.permanent){await markSocialFailure(processing,err,{permanent:true});console.warn(`[instagram] failed articleId=${article.id} reason=media_processing_failed`);return{status:'skipped',reason:'media_processing_failed'}}await markSocialFailure(processing,err,{retryAfterMs:retryDelay(processing.attempts)});console.log(`[instagram] failed articleId=${article.id} reason=media_processing_pending`);return{status:'retry',reason:'media_processing_pending'}}
      const mediaId=await publishMediaContainer(containerId);const publishedAt=new Date().toISOString();const record=await markSocialPublished(processing,{mediaId,publishedAt});await incrementDailyPublishedCount(now);console.log(`[instagram] published articleId=${article.id} mediaId=${mediaId}`);return{status:'published',articleId:article.id,slug:article.slug,mediaId,publishedAt,queueRemaining:Math.max(0,eligible.length-1),publishedToday:daily+1,record};
    }catch(error){const classification=classifyInstagramError(error);const permanent=classification.kind==='permanent';await markSocialFailure(processing,error,{permanent,retryAfterMs:retryDelay(processing.attempts)});if(classification.reason==='auth_token_invalid')console.warn('[instagram] failed reason=instagram_auth_failed');else console.warn(`[instagram] failed articleId=${article.id} reason=${classification.reason}`);return{status:permanent?'failed':'retry',articleId:article.id,reason:classification.reason};}
  }finally{await releaseLock(SOCIAL_LOCK_KEY,lockToken).catch(()=>{});}
}
if(process.argv[1]?.endsWith('/worker/social-run.js'))runSocialCycle({trigger:'cli'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(`[social] fatal ${String(error?.message||error).slice(0,240)}`);process.exitCode=1});
