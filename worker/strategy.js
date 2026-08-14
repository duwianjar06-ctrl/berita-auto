import {classifyCategory} from './category.js';

const NORMAL_MAX=1;
const DELAYED_MAX=2;
const STALE_MAX=3;
const LONG_OUTAGE_MAX=5;
const HARD_MAX=5;
const LOW_WATERMARK=30;
const QUEUE_TARGET=60;
const QUEUE_MAX=120;
const MAX_AGE_MS=12*60*60*1000;

function ageMs(value,now){const t=Date.parse(value||'');return Number.isFinite(t)?Math.max(0,now-t):Infinity;}
function freshness(value,now){const age=ageMs(value,now);if(age<=2*60*60*1000)return 100;if(age<=6*60*60*1000)return 70;if(age<=12*60*60*1000)return 35;return 0;}
function priority(item,now,recentSources=[]){const category=item.category||classifyCategory(item);const breaking=/breaking|darurat|terkini|meninggal|gempa|kebakaran|banjir|evakuasi/i.test(`${item.title} ${item.summary||''}`)?25:0;const international=category==='Internasional'?10:0;const sourceRotation=recentSources.includes(String(item.sourceName||'').trim())?-15:15;return freshness(item.publishedAt,now)+breaking+international+sourceRotation;}
function categoryWeight(category,counts){const count=counts.get(category)||0;return Math.max(0,20-count*8);}

export function recentPublicationRate(published=[],now=Date.now()){
  const stamps=published.slice(0,6).map(x=>Date.parse(x.sitePublishedAt||x.createdAt||'')).filter(Number.isFinite);
  if(stamps.length<2)return 0;
  let totalGap=0;let gaps=0;
  for(let i=0;i<stamps.length-1;i++){totalGap+=Math.abs(stamps[i]-stamps[i+1]);gaps++;}
  const avgGapMinutes=(totalGap/gaps)/60000;
  return avgGapMinutes>0?60/avgGapMinutes:0;
}

export function publicationPlan(published=[],pending=[],now=Date.now()){
  const pendingCount=pending.length;
  if(!pendingCount)return{mode:'idle',maxPublish:0,gapMinutes:0,pendingCount,recentRatePerHour:recentPublicationRate(published,now)};
  const last=published[0];
  const lastStamp=Date.parse(last?.sitePublishedAt||last?.createdAt||'');
  if(!Number.isFinite(lastStamp))return{mode:'live',maxPublish:NORMAL_MAX,gapMinutes:Infinity,pendingCount,recentRatePerHour:recentPublicationRate(published,now)};
  const gapMinutes=Math.max(0,(now-lastStamp)/60000);
  const recentRatePerHour=recentPublicationRate(published,now);
  if(gapMinutes<10)return{mode:'normal',maxPublish:NORMAL_MAX,gapMinutes,pendingCount,recentRatePerHour};
  if(gapMinutes<20)return{mode:'delayed',maxPublish:DELAYED_MAX,gapMinutes,pendingCount,recentRatePerHour};
  if(gapMinutes<45)return{mode:'stale',maxPublish:STALE_MAX,gapMinutes,pendingCount,recentRatePerHour};
  return{mode:'long-outage',maxPublish:LONG_OUTAGE_MAX,gapMinutes,pendingCount,recentRatePerHour};
}

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
  const counts=new Map(pending.map(x=>[x.category,pending.filter(y=>y.category===x.category).length]));
  const recentSources=[...new Set(existing.slice(0,6).map(x=>String(x.sourceName||'').trim()).filter(Boolean))];
  for(const item of candidates)item.priority=priority(item,now,recentSources)+categoryWeight(item.category,counts);
  candidates.sort((a,b)=>b.priority-a.priority||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const target=Math.min(HARD_MAX,Math.max(NORMAL_MAX,DELAYED_MAX),Math.max(0,QUEUE_MAX-pending.length));
  const buckets=new Map();
  for(const item of candidates){if(!buckets.has(item.category))buckets.set(item.category,[]);buckets.get(item.category).push(item);}
  const categories=[...buckets.keys()].sort((a,b)=>Math.max(...buckets.get(b).map(x=>x.priority))-Math.max(...buckets.get(a).map(x=>x.priority)));
  const selected=[];let round=0;
  while(selected.length<target){let progressed=false;for(const category of categories){const bucket=buckets.get(category);if(round<bucket.length&&selected.length<target){selected.push(bucket[round]);progressed=true;}}if(!progressed)break;round++;}
  return {items:selected,catchUp:selected.length>1,max:target,queueTarget:QUEUE_TARGET,queueMax:QUEUE_MAX};
}

export function selectPublication(pending,history=[],now=Date.now()){
  if(!pending.length)return null;
  const recentCategories=history.slice(0,6).map(x=>x.category).filter(Boolean);
  const recentSources=history.slice(0,6).map(x=>String(x.sourceName||'').trim()).filter(Boolean);
  const scored=pending.map((item,index)=>{
    const age=freshness(item.publishedAt,now);
    const breaking=/breaking|darurat|gempa|kebakaran|banjir|evakuasi/i.test(`${item.title} ${item.summary||''}`)?35:0;
    const rotation=recentCategories.includes(item.category)?-20:15;
    const sourceRotation=recentSources.includes(String(item.sourceName||'').trim())?-20:18;
    const international=item.category==='Internasional'?12:0;
    return {...item,_score:age+breaking+rotation+sourceRotation+international-index*0.1};
  });
  scored.sort((a,b)=>b._score-a._score);
  const chosen={...scored[0]};delete chosen._score;return chosen;
}

export const queueConfig={NORMAL_MAX,DELAYED_MAX,STALE_MAX,LONG_OUTAGE_MAX,HARD_MAX,LOW_WATERMARK,QUEUE_TARGET,QUEUE_MAX,MAX_AGE_MS};
