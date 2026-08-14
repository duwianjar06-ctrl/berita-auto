import {fetchNews} from '../lib/rss.js';
import {generateArticle} from '../lib/ai.js';
import {readArticles,writeArticles,readPending,writePending} from '../lib/storage.js';
import {articleFingerprint} from './normalize.js';
import {selectIngestionCandidates,selectPublication,queueConfig} from './strategy.js';
import {enrichArticle} from './image-enrichment.js';
import {classifyCategory} from './category.js';

const start=Date.now();
const now=Date.now();
console.log('[worker] scheduled run');
const published=await readArticles();
const pending=await readPending();
const seen=new Set(published.map(a=>a.fingerprint).filter(Boolean));
const rssStart=Date.now();
const fetched=await fetchNews();
console.log(`[perf] rss ${Date.now()-rssStart}ms`);
const normalized=fetched.map(item=>{const {rawXml,rawDescription,...clean}=item;return {...clean,fingerprint:item.fingerprint||articleFingerprint(item),category:classifyCategory(item)}});

const pendingFresh=pending.filter(item=>{const stamp=Date.parse(item.publishedAt||'');return !Number.isFinite(stamp)||now-stamp<=queueConfig.MAX_AGE_MS;});
const refill=selectIngestionCandidates(normalized,seen,pendingFresh,published,now);
const combined=[...pendingFresh,...refill.items];
console.log(`[queue] before=${pending.length} expired=${pending.length-pendingFresh.length} added=${refill.items.length} after-ingest=${combined.length}`);
console.log(`[queue] mode=${refill.catchUp?'catch-up':'normal'} intake-max=${refill.max}`);

const chosen=selectPublication(combined,published.slice(0,8),now);
if(!chosen){
  await writePending(combined.slice(0,queueConfig.QUEUE_MAX));
  console.log('[publish] queue empty; nothing published');
} else {
  const imageResult=await Promise.allSettled([enrichArticle(chosen)]);
  const image=imageResult[0].status==='fulfilled'?imageResult[0].value:{imageUrl:chosen.imageUrl||null,source:chosen.imageUrl?'rss':'none'};
  const aiStart=Date.now();
  const ai=await generateArticle(chosen);
  console.log(`[perf] article generation ${Date.now()-aiStart}ms`);
  const sitePublishedAt=new Date().toISOString();
  const article={id:chosen.fingerprint,fingerprint:chosen.fingerprint,slug:chosen.slug,title:ai.title,summary:chosen.summary||ai.excerpt||chosen.title,excerpt:ai.excerpt||chosen.summary||chosen.title,content:ai.content,url:chosen.url,sourceUrl:chosen.sourceUrl,sourceName:chosen.sourceName,category:chosen.category||'Nasional',imageUrl:image.imageUrl||chosen.imageUrl||null,imageSource:image.source||null,publishedAt:chosen.publishedAt||null,sourcePublishedAt:chosen.publishedAt||null,sitePublishedAt,createdAt:sitePublishedAt};
  const remaining=combined.filter(item=>item.fingerprint!==chosen.fingerprint);
  const next=[article,...published].filter((item,index,array)=>index===array.findIndex(x=>x.fingerprint===item.fingerprint)).slice(0,500);
  await writeArticles(next);
  await writePending(remaining.slice(0,queueConfig.QUEUE_MAX));
  console.log(`[publish] title: ${article.title}`);
  console.log(`[publish] source: ${article.sourceName}`);
  console.log(`[publish] category: ${article.category}`);
  console.log(`[publish] sitePublishedAt: ${article.sitePublishedAt}`);
  console.log(`[queue] after-publish=${remaining.length}`);
  console.log('[worker] complete publications=1');
}
console.log(`[perf] total ${Date.now()-start}ms`);
