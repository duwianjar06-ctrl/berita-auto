import {readArticles,writeArticles} from '../lib/storage.js';
import {fetchSourceMaterial} from './source-material.js';
import {generateArticle} from '../lib/ai.js';

const items=await readArticles();
const bad=items.filter(item=>/\.{3,}/.test(`${item.excerpt||''} ${item.content||''}`)||String(item.content||'').length<400).slice(0,1);
if(!bad.length){console.log('[repair] no obvious truncated article');process.exit(0)}
const item=bad[0];
const material=await fetchSourceMaterial(item);
if(!material||material.length<400){console.log(`[repair] candidate=${item.id}; insufficient source material`);process.exit(3)}
const generated=await generateArticle(item,material);
if(generated.generationProvider==='fallback'){
  console.log(`[repair] candidate=${item.id}; AI unavailable; refusing historical fallback overwrite`);
  process.exit(2);
}
const repaired={...item,title:generated.title,excerpt:generated.excerpt,content:generated.content,generationProvider:generated.generationProvider,generationModel:generated.generationModel||null,generationAt:generated.generationAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
await writeArticles(items.map(x=>x.id===item.id?repaired:x));
console.log(`[repair] repaired=${item.id} provider=${generated.generationProvider}`);
