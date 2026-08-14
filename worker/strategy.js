import {classifyCategory} from './category.js';

const NORMAL_MAX=24;
const CATCHUP_MAX=48;
const LOW_WATERMARK=30;
const QUEUE_TARGET=60;
const QUEUE_MAX=120;
const MAX_AGE_MS=12*60*60*1000;
const MAX_PUBLICATIONS_NORMAL=1;
const MAX_PUBLICATIONS_CATCHUP=3;
const CATCHUP_AFTER_MINUTES=15;

function ageMs(value,now){const t=Date.parse(value||'');return Number.isFinite(t)?Math.max(0,now-t):Infinity;}
function freshness(value,now){const age=ageMs(value,now);if(age<=2*60*60*1000)return 100;if(age<=6*60*60*1000)return 70;if(age<=12*60*60*1000)return 35;return 0;}
function priority(item,now){const category=item.category||classifyCategory(item);const breaking=/breaking|darurat|terkini|meninggal|gempa|kebakaran|banjir|evakuasi/i.test(`${item.title} ${item.summary||''}`)?25:0;const international=category==='Internasional'?10:0;return freshness(item.publishedAt,now)+breaking+international;}
function categoryWeight(category,counts){const count=counts.get(category)||0;return Math.max(0,20-count*8);}

export function selectIngestionCandidates(items,seen,pending=[],existing=[],now=Date.now()){
  const pendingSet=new Set(pending.map(x=>x.fingerprint).filter(Boolean));
  const publishedSet=seen instanceof Set?seen:new Set(existing.map(x=>x.fingerprint).filter(Boolean));
  const unique=new Map();
  for(const raw of items){
    const fingerprint=raw.fingerprint;
    if(!fingerprint||publishedSet.has(fingerprint)||pendingSet.has(fingerprint)||unique.has(fingerprint))continue;
    const category=classifyCategory(raw);
    const age=ageMs(raw.publishedAt,now);
    if(age>MAX_AGE_MS)continue;
    unique.set(fingerprint,{...raw,category,queuedAt:new Date(now).toISOString(),priority:0});
  }
  const candidates=[...unique.values()];
  const counts=new Map(pending.map(x=>[x.category,(pending.filter(y=>y.category===x.category).length)]));
  for(const item of candidates)item.priority=priority(item,now)+categoryWeight(item.category,counts);
  candidates.sort((a,b)=>b.priority-a.priority||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const catchUp=pending.length<LOW_WATERMARK;
  const max=catchUp?CATCHUP_MAX:NORMAL_MAX;
  const target=Math.min(max,Math.max(0,QUEUE_MAX-pending.length));
  const buckets=new Map();
  for(const item of candidates){if(!buckets.has(item.category))buckets.set(item.category,[]);buckets.get(item.category).push(item);}
  const categories=[...buckets.keys()].sort((a,b)=>{const pa=Math.max(...buckets.get(a).map(x=>x.priority));const pb=Math.max(...buckets.get(b).map(x=>x.priority));return pb-pa;});
  const selected=[];let round=0;
  while(selected.length<target){let progressed=false;for(const category of categories){const bucket=buckets.get(category);if(round<bucket.length&&selected.length<target){selected.push(bucket[round]);progressed=true;}}if(!progressed)break;round++;}
  return {items:selected,catchUp,max,queueTarget:QUEUE_TARGET,queueMax:QUEUE_MAX};
}

export function selectPublication(pending,history=[],now=Date.now()){
  if(!pending.length)return null;
  const recentCategories=history.slice(0,6).map(x=>x.category).filter(Boolean);
  const scored=pending.map((item,index)=>{
    const age=freshness(item.publishedAt,now);
    const breaking=/breaking|darurat|gempa|kebakaran|banjir|evakuasi/i.test(`${item.title} ${item.summary||''}`)?35:0;
    const rotation=recentCategories.includes(item.category)?-20:15;
    const international=item.category==='Internasional'?12:0;
    return {...item,_score:age+breaking+rotation+international-index*0.1};
  });
  scored.sort((a,b)=>b._score-a._score);
  const chosen={...scored[0]};delete chosen._score;return chosen;
}

export const queueConfig={NORMAL_MAX,CATCHUP_MAX,LOW_WATERMARK,QUEUE_TARGET,QUEUE_MAX,MAX_AGE_MS,MAX_PUBLICATIONS_NORMAL,MAX_PUBLICATIONS_CATCHUP,CATCHUP_AFTER_MINUTES};
