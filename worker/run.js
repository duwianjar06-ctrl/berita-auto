import {fetchNews} from '../lib/rss.js';
import {generateArticle} from '../lib/ai.js';
import {readArticles,writeArticles,readPending,writePending} from '../lib/storage.js';
import {articleFingerprint} from './normalize.js';
import {selectIngestionCandidates,selectPublication,queueConfig} from './strategy.js';
import {enrichArticle} from './image-enrichment.js';
import {classifyCategory} from './category.js';
import {startPipelineRun,setPipelineStage,finishPipelineStage,completePipelineRun} from '../lib/pipeline.js';

const started=Date.now();
const now=Date.now();
const run=await startPipelineRun({scheduledAt:process.env.GITHUB_RUN_STARTED_AT||new Date().toISOString()});
const runId=run?.id;
console.log('[worker] scheduled run');
try{
  let t=Date.now();await setPipelineStage(runId,'READING_STATE',t);const published=await readArticles();const pending=await readPending();await finishPipelineStage(runId,'READING_STATE',t);
  const seen=new Set(published.map(a=>a.fingerprint).filter(Boolean));
  t=Date.now();await setPipelineStage(runId,'DISCOVERING',t);const fetched=await fetchNews();console.log(`[perf] rss ${Date.now()-t}ms`);await finishPipelineStage(runId,'DISCOVERING',t);
  t=Date.now();await setPipelineStage(runId,'NORMALIZING',t);const normalized=fetched.map(item=>{const{rawXml,rawDescription,...clean}=item;return{...clean,fingerprint:item.fingerprint||articleFingerprint(item),category:classifyCategory(item)}});await finishPipelineStage(runId,'NORMALIZING',t);
  t=Date.now();await setPipelineStage(runId,'QUEUING',t);const pendingFresh=pending.filter(item=>{const stamp=Date.parse(item.publishedAt||'');return !Number.isFinite(stamp)||now-stamp<=queueConfig.MAX_AGE_MS});const refill=selectIngestionCandidates(normalized,seen,pendingFresh,published,now);const combined=[...pendingFresh,...refill.items];console.log(`[queue] before=${pending.length} expired=${pending.length-pendingFresh.length} added=${refill.items.length} after-ingest=${combined.length}`);console.log(`[queue] mode=${refill.catchUp?'catch-up':'normal'} intake-max=${refill.max}`);await finishPipelineStage(runId,'QUEUING',t);
  t=Date.now();await setPipelineStage(runId,'SELECTING',t);const chosen=selectPublication(combined,published.slice(0,8),now);await finishPipelineStage(runId,'SELECTING',t);
  if(!chosen){await writePending(combined.slice(0,queueConfig.QUEUE_MAX));await completePipelineRun(runId,{status:'COMPLETED',stage:'IDLE',published:0,summary:{queueCount:combined.length,totalMs:Date.now()-started}});console.log('[publish] queue empty; nothing published');return}
  t=Date.now();await setPipelineStage(runId,'IMAGE_PROCESSING',t);const imageResult=await Promise.allSettled([enrichArticle(chosen)]);const image=imageResult[0].status==='fulfilled'?imageResult[0].value:{imageUrl:chosen.imageUrl||null,source:chosen.imageUrl?'rss':'none'};await finishPipelineStage(runId,'IMAGE_PROCESSING',t);
  const aiStart=Date.now();await setPipelineStage(runId,'PARAPHRASING',aiStart);const ai=await generateArticle(chosen);const aiDurationMs=Date.now()-aiStart;console.log(`[perf] ai ${aiDurationMs}ms provider=${ai.generationProvider}`);await finishPipelineStage(runId,'PARAPHRASING',aiStart);
  t=Date.now();await setPipelineStage(runId,'VALIDATING',t);if(!ai.title||!ai.excerpt||!ai.content)throw new Error('invalid_article_output');await finishPipelineStage(runId,'VALIDATING',t);
  t=Date.now();await setPipelineStage(runId,'PUBLISHING',t);const sitePublishedAt=new Date().toISOString();const article={id:chosen.fingerprint,fingerprint:chosen.fingerprint,slug:chosen.slug,title:ai.title,summary:chosen.summary||ai.excerpt||chosen.title,excerpt:ai.excerpt||chosen.summary||chosen.title,content:ai.content,url:chosen.url,sourceUrl:chosen.sourceUrl,sourceName:chosen.sourceName,category:chosen.category||'Nasional',imageUrl:image.imageUrl||chosen.imageUrl||null,imageSource:image.source||null,publishedAt:chosen.publishedAt||null,sourcePublishedAt:chosen.publishedAt||null,sitePublishedAt,createdAt:sitePublishedAt,generationProvider:ai.generationProvider||'fallback',generationModel:ai.generationModel||null,generationAt:ai.generationAt||sitePublishedAt,generationDurationMs:aiDurationMs};const remaining=combined.filter(item=>item.fingerprint!==chosen.fingerprint);const next=[article,...published].filter((item,index,array)=>index===array.findIndex(x=>x.fingerprint===item.fingerprint)).slice(0,500);await writeArticles(next);await writePending(remaining.slice(0,queueConfig.QUEUE_MAX));await finishPipelineStage(runId,'PUBLISHING',t);
  await completePipelineRun(runId,{status:'COMPLETED',stage:'COMPLETED',published:1,summary:{provider:article.generationProvider,model:article.generationModel,aiDurationMs,workerDurationMs:Date.now()-started,pendingCount:remaining.length,candidatesFound:combined.length,accepted:1,rejected:Math.max(0,combined.length-1)}});
  console.log(`[publish] title: ${article.title}`);console.log(`[publish] source: ${article.sourceName}`);console.log(`[publish] category: ${article.category}`);console.log(`[publish] sitePublishedAt: ${article.sitePublishedAt}`);console.log(`[publish] generationProvider: ${article.generationProvider}`);console.log(`[queue] after-publish=${remaining.length}`);console.log('[worker] complete publications=1');
}catch(error){const safe=String(error?.message||error).slice(0,240);await completePipelineRun(runId,{status:'FAILED',stage:'FAILED',published:0,error:safe,summary:{workerDurationMs:Date.now()-started}}).catch(()=>{});console.error(`[worker] failed ${safe}`);throw error}
console.log(`[perf] total ${Date.now()-started}ms`);
