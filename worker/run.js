import {fileURLToPath} from 'node:url';
import {fetchNews} from '../lib/rss.js';
import {generateArticle} from '../lib/ai.js';
import {readArticles,writeArticles,readPending,writePending} from '../lib/storage.js';
import {persistenceConfigured,acquireLock,releaseLock} from '../lib/persistence.js';
import {articleFingerprint,titleFingerprint} from './normalize.js';
import {selectIngestionCandidates,selectPublication,publicationPlan,queueConfig} from './strategy.js';
import {enrichArticle,isValidImageUrl} from './image-enrichment.js';
import {classifyCategory} from './category.js';
import {startPipelineRun,setPipelineStage,finishPipelineStage,completePipelineRun,getPipelineSnapshot} from '../lib/pipeline.js';

const LOCK_KEY='ba:news:publication-lock';
const LOCK_TTL_SECONDS=120;

export async function runPublicationCycle({trigger='manual',now=Date.now()}={}){
  if(trigger==='vercel-cron'&&!persistenceConfigured())throw new Error('persistent_database_not_configured');
  const started=Date.now();const cycleNow=Number.isFinite(now)?now:Date.now();const lockToken=`${trigger}:${process.pid}:${Date.now()}`;
  const locked=persistenceConfigured()?await acquireLock(LOCK_KEY,lockToken,LOCK_TTL_SECONDS):false;
  if(persistenceConfigured()&&!locked){console.log('[worker] skipped: publication lock already held');return {status:'skipped',published:0,reason:'worker_active'};}
  let runId=null;
  try{
    const run=await startPipelineRun({scheduledAt:process.env.GITHUB_RUN_STARTED_AT||new Date(cycleNow).toISOString(),triggerMode:trigger});runId=run?.id;
    let t=Date.now();await setPipelineStage(runId,'READING_STATE',t);const published=await readArticles();const pending=await readPending();const snapshot=await getPipelineSnapshot();const consecutiveFailures=(snapshot.runs||[]).slice(0,20).reduce((n,row)=>row?.status==='FAILED'?n+1:0,0);await finishPipelineStage(runId,'READING_STATE',t);
    const seen=new Set(published.map(a=>a.fingerprint).filter(Boolean));
    t=Date.now();await setPipelineStage(runId,'DISCOVERING',t);const fetchedResult=await fetchNews();console.log(`[perf] rss=${Date.now()-t}ms`);await finishPipelineStage(runId,'DISCOVERING',t);
    t=Date.now();await setPipelineStage(runId,'NORMALIZING',t);const normalized=fetchedResult.items.map(item=>{const{rawXml,rawDescription,...clean}=item;return{...clean,fingerprint:item.fingerprint||articleFingerprint(item),titleFingerprint:item.titleFingerprint||titleFingerprint(item.title),category:classifyCategory(item),sourceWeight:Number(item.sourceWeight)||1};});await finishPipelineStage(runId,'NORMALIZING',t);
    t=Date.now();await setPipelineStage(runId,'QUEUING',t);const pendingFresh=pending.filter(item=>{const stamp=Date.parse(item.publishedAt||'');return !Number.isFinite(stamp)||cycleNow-stamp<=queueConfig.MAX_AGE_MS});const refill=selectIngestionCandidates(normalized,seen,pendingFresh,published,cycleNow);let remaining=[...pendingFresh,...refill.items];const plan=publicationPlan(published,remaining,cycleNow);console.log(`[queue] before=${pending.length} expired=${pending.length-pendingFresh.length} added=${refill.items.length} after=${remaining.length} mode=${plan.mode} max=${plan.maxPublish} failures=${consecutiveFailures}`);await finishPipelineStage(runId,'QUEUING',t);
    let publishedNow=[...published];let publicationCount=0;let lastError=null;const publicationStart=Date.now();const aiStats={geminiSuccess:0,geminiFailed:0,secondarySuccess:0,fallback:0};
    while(publicationCount<plan.maxPublish&&remaining.length){
      let chosen=null;
      try{
        t=Date.now();await setPipelineStage(runId,'SELECTING',t);chosen=selectPublication(remaining,publishedNow.slice(0,10),Date.now());await finishPipelineStage(runId,'SELECTING',t);if(!chosen)break;
        t=Date.now();await setPipelineStage(runId,'IMAGE_PROCESSING',t);const imageResult=await enrichArticle(chosen);await finishPipelineStage(runId,'IMAGE_PROCESSING',t);if(!isValidImageUrl(imageResult.imageUrl)){console.warn(`[publish] skipped=no_valid_image articleId=${chosen.fingerprint||'unknown'} publisher=${chosen.publisher||chosen.sourceName||'unknown'}`);remaining=remaining.filter(item=>item.fingerprint!==chosen.fingerprint);continue;}
        t=Date.now();await setPipelineStage(runId,'PARAPHRASING',t);const ai=await generateArticle(chosen);const aiDurationMs=Date.now()-t;const provider=ai.generationProvider||'fallback';if(provider==='gemini')aiStats.geminiSuccess++;else if(provider==='openai')aiStats.secondarySuccess++;else aiStats.fallback++;console.log(`[perf] ai=${aiDurationMs}ms provider=${provider} articleId=${chosen.fingerprint||'unknown'}`);await finishPipelineStage(runId,'PARAPHRASING',t);
        t=Date.now();await setPipelineStage(runId,'VALIDATING',t);if(!ai.title||!ai.excerpt||!ai.content)throw new Error('invalid_article_output');await finishPipelineStage(runId,'VALIDATING',t);
        t=Date.now();await setPipelineStage(runId,'PUBLISHING',t);const sitePublishedAt=new Date().toISOString();const article={id:chosen.fingerprint,fingerprint:chosen.fingerprint,titleFingerprint:chosen.titleFingerprint,title:ai.title,summary:chosen.summary||ai.excerpt||chosen.title,excerpt:ai.excerpt||chosen.summary||chosen.title,content:ai.content,url:chosen.url,sourceUrl:chosen.sourceUrl,sourceName:chosen.sourceName,publisher:chosen.publisher||chosen.sourceName,sourceId:chosen.sourceId||null,category:chosen.category||'Nasional',language:ai.language||'id',imageUrl:imageResult.imageUrl,imageSource:imageResult.source||null,publishedAt:chosen.publishedAt||null,sourcePublishedAt:chosen.publishedAt||null,sitePublishedAt,createdAt:sitePublishedAt,generationProvider:ai.generationProvider||'fallback',generationModel:ai.generationModel||null,generationAt:ai.generationAt||sitePublishedAt,generationDurationMs:aiDurationMs};
        remaining=remaining.filter(item=>item.fingerprint!==chosen.fingerprint&&item.titleFingerprint!==article.titleFingerprint);publishedNow=[article,...publishedNow].filter((item,i,array)=>i===array.findIndex(x=>x.fingerprint===item.fingerprint)).slice(0,500);publicationCount++;await writeArticles(publishedNow);await writePending(remaining.slice(0,queueConfig.QUEUE_MAX));await finishPipelineStage(runId,'PUBLISHING',t);console.log(`[publish #${publicationCount}] publisher=${article.publisher} source=${article.sourceUrl} sourcePublishedAt=${article.sourcePublishedAt} sitePublishedAt=${article.sitePublishedAt} ai=${article.generationProvider}`);
      }catch(error){lastError=error;console.error(`[publish] attempt=${publicationCount+1} articleId=${chosen?.fingerprint||'unknown'} error=${String(error?.message||error).slice(0,240)}`);break;}
    }
    const duration=Date.now()-started;const summary={provider:publishedNow[0]?.generationProvider||null,model:publishedNow[0]?.generationModel||null,workerDurationMs:duration,publishDurationMs:Date.now()-publicationStart,pendingCount:remaining.length,candidatesFound:pendingFresh.length+refill.items.length,accepted:publicationCount,rejected:Math.max(0,pendingFresh.length+refill.items.length-publicationCount),mode:plan.mode,maxPublications:plan.maxPublish,gapMinutes:Number.isFinite(plan.gapMinutes)?plan.gapMinutes:null,recentRatePerHour:plan.recentRatePerHour,lastPublishedAt:publishedNow[0]?.sitePublishedAt||null,consecutiveFailures:publicationCount?0:consecutiveFailures,sourceStats:fetchedResult.sourceStats,aiStats};
    if(!publicationCount&&lastError)throw lastError;await completePipelineRun(runId,{status:'COMPLETED',stage:publicationCount?'COMPLETED':'IDLE',published:publicationCount,summary});const distribution=publishedNow.slice(0,10).reduce((m,a)=>{const p=a.publisher||a.sourceName||'unknown';m[p]=(m[p]||0)+1;return m},{});console.log(`[distribution] ${Object.entries(distribution).map(([p,n])=>`${p}=${n}`).join(' ')}`);console.log(`[worker] complete published=${publicationCount} queue=${remaining.length} duration=${duration}ms`);return {status:'completed',published:publicationCount,queue:remaining.length,mode:plan.mode,workerDurationMs:duration};
  }catch(error){const safe=String(error?.message||error).slice(0,240);if(runId)await completePipelineRun(runId,{status:'FAILED',stage:'FAILED',published:0,error:safe,summary:{workerDurationMs:Date.now()-started,triggerMode:trigger}}).catch(()=>{});console.error(`[worker] failed ${safe}`);throw error;}finally{if(locked)await releaseLock(LOCK_KEY,lockToken).catch(()=>{});console.log(`[perf] total=${Date.now()-started}ms`);}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])runPublicationCycle({trigger:process.env.NEWS_TRIGGER_MODE||'cli',now:Date.now()}).catch(error=>{console.error(`[worker] fatal ${String(error?.message||error).slice(0,240)}`);process.exitCode=1});
