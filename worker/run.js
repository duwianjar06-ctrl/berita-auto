import {fetchNews} from '../lib/rss.js';
import {generateArticle} from '../lib/ai.js';
import {readArticles,writeArticles} from '../lib/storage.js';
import {articleFingerprint} from './normalize.js';
import {selectCandidates} from './strategy.js';
import {enrichArticle,backfillArticles} from './image-enrichment.js';
import {classifyCategory} from './category.js';

const start=Date.now();
const loaded=await readArticles();
const old=loaded.map(article=>({...article,category:classifyCategory(article)}));
const seen=new Set(old.map(a=>a.fingerprint));
console.log('[worker] scheduled run');
const rssStart=Date.now();
const fetched=await fetchNews();
console.log(`[perf] rss ${Date.now()-rssStart}ms`);
const items=fetched.map(i=>({...i,fingerprint:articleFingerprint(i)}));
const selectionStart=Date.now();
const selected=selectCandidates(items,seen,old);
const candidates=selected.items;
console.log(`[perf] classify/select ${Date.now()-selectionStart}ms`);
console.log(`[candidates] new: ${candidates.length}`);
console.log(`[candidates] mode: ${selected.catchUp?'catch-up':'normal'} max=${selected.max}`);

async function processCandidate(item){
  const started=Date.now();
  const [imageResult,aiResult]=await Promise.allSettled([enrichArticle(item),generateArticle(item)]);
  const image=imageResult.status==='fulfilled'?imageResult.value:{imageUrl:null,source:'none'};
  const ai=aiResult.status==='fulfilled'?aiResult.value:{title:item.title,excerpt:item.summary||item.title,content:`${item.summary||item.title}\n\nSumber: ${item.url}`};
  const {rawXml,rawDescription,...cleanItem}=item;
  console.log(`[publish] title: ${item.title}`);
  console.log(`[publish] source: ${item.sourceName||item.sourceUrl}`);
  console.log(`[publish] category: ${item.category||'Nasional'}`);
  console.log(`[perf] article ${item.fingerprint} ${Date.now()-started}ms`);
  return {id:item.fingerprint,...cleanItem,...ai,imageUrl:image.imageUrl,imageSource:image.source,createdAt:new Date().toISOString()};
}

const processStart=Date.now();
const fresh=[];
for(let i=0;i<candidates.length;i+=4){
  const results=await Promise.allSettled(candidates.slice(i,i+4).map(processCandidate));
  for(const result of results)if(result.status==='fulfilled')fresh.push(result.value);else console.error(`[publish] failed: ${result.reason?.message||result.reason}`);
}
console.log(`[perf] article generation ${Date.now()-processStart}ms`);
const backfillStart=Date.now();
const backfill=selected.catchUp?{checked:0,updated:0}:await backfillArticles([...fresh,...old],4,4);
console.log(`[perf] image ${Date.now()-backfillStart}ms`);
console.log(`[image] RSS image found: ${fresh.filter(a=>a.imageSource==='rss').length}`);
console.log(`[image] OpenGraph fallback: ${fresh.filter(a=>a.imageSource==='og').length+backfill.updated}`);
console.log(`[image] unavailable: ${fresh.filter(a=>!a.imageUrl).length}`);
console.log(`[image] backfilled: ${backfill.updated}`);
const storageStart=Date.now();
const next=[...fresh,...old].slice(0,200).map(({imageSource,...article})=>article);
await writeArticles(next);
console.log(`[perf] storage ${Date.now()-storageStart}ms`);
console.log(`[publish] selected: ${fresh.length}`);
console.log('[worker] complete');
console.log(`[perf] total ${Date.now()-start}ms`);
