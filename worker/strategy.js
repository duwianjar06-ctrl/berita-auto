import {classifyCategory} from './category.js';
function sortNewest(a,b){return (Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0);}
function latestCreatedAt(existing){const value=existing.map(a=>Date.parse(a.createdAt||a.publishedAt)).filter(Number.isFinite).sort((a,b)=>b-a)[0];return value||0;}
export function selectCandidates(items,seen,existing=[],now=Date.now()){
  const fresh=[],run=new Set();
  for(const item of items){const fingerprint=item.fingerprint;if(!fingerprint||seen.has(fingerprint)||run.has(fingerprint))continue;const category=classifyCategory(item);run.add(fingerprint);fresh.push({...item,category});}
  fresh.sort(sortNewest);
  const elapsed=latestCreatedAt(existing)?now-latestCreatedAt(existing):Infinity;
  const max=elapsed>=15*60*1000?24:12;
  const maxPerCategory=3;
  const buckets=new Map();
  for(const item of fresh){if(!buckets.has(item.category))buckets.set(item.category,[]);if(buckets.get(item.category).length<maxPerCategory)buckets.get(item.category).push(item);}
  const categories=[...buckets.keys()].sort((a,b)=>(Date.parse(buckets.get(b)[0]?.publishedAt)||0)-(Date.parse(buckets.get(a)[0]?.publishedAt)||0));
  const selected=[];let index=0;
  while(selected.length<max&&categories.length){let progressed=false;for(const category of categories){const bucket=buckets.get(category);if(index<bucket.length&&selected.length<max){selected.push(bucket[index]);progressed=true;}}if(!progressed)break;index++;}
  return {items:selected,max,catchUp:elapsed>=15*60*1000};
}
