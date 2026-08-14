const url=()=>process.env.UPSTASH_REDIS_REST_URL;
const token=()=>process.env.UPSTASH_REDIS_REST_TOKEN;
export function analyticsConfigured(){return Boolean(url()&&token())}
async function redis(command){if(!analyticsConfigured())return null;const response=await fetch(url(),{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store'});if(!response.ok)throw new Error(`analytics redis ${response.status}`);const data=await response.json();if(data.error)throw new Error(data.error);return data.result}
async function pipeline(commands){if(!analyticsConfigured())return [];const response=await fetch(`${url()}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify(commands),cache:'no-store'});if(!response.ok)throw new Error(`analytics pipeline ${response.status}`);return response.json()}
const safe=v=>String(v||'unknown').trim().replace(/[^\p{L}\p{N}._:-]+/gu,'_').slice(0,80)||'unknown';
const dateKey=(date=new Date())=>date.toISOString().slice(0,10);
const recentDates=(days,date=new Date())=>Array.from({length:days},(_,i)=>{const d=new Date(date);d.setUTCDate(d.getUTCDate()-i);return dateKey(d)});
const dayViews=d=>`ba:views:${d}`;
const geoKey=(d,dim)=>`ba:geo:${d}:${dim}`;
const geoArticleKey=(d,dim,value)=>`ba:geo:${d}:${dim}:article:${safe(value)}`;

export async function recordView({articleId,country,region,city}){
  if(!analyticsConfigured())return {recorded:false,reason:'not-configured'};
  const today=dateKey();const commands=[['ZINCRBY','ba:views:alltime',1,articleId],['ZINCRBY',dayViews(today),1,articleId],['EXPIRE',dayViews(today),35*86400]];
  for(const [dim,value] of [['country',country],['region',region],['city',city]]){
    if(!value)continue;
    commands.push(['ZINCRBY',geoKey(today,dim),1,safe(value)]);
    commands.push(['ZINCRBY',geoArticleKey(today,dim,value),1,articleId]);
    commands.push(['EXPIRE',geoKey(today,dim),35*86400]);
    commands.push(['EXPIRE',geoArticleKey(today,dim,value),35*86400]);
  }
  await pipeline(commands);return {recorded:true};
}

async function windowScores(days){
  const keys=recentDates(days).map(dayViews);if(!keys.length)return new Map();if(keys.length===1){const rows=await redis(['ZRANGE',keys[0],0,-1,'WITHSCORES']);return rowsToMap(rows)}
  const temp=`ba:tmp:${Date.now()}:${Math.random().toString(36).slice(2)}`;const result=await pipeline([['ZUNIONSTORE',temp,keys.length,...keys],['ZRANGE',temp,0,-1,'WITHSCORES'],['EXPIRE',temp,60],['DEL',temp]]);return rowsToMap(result?.[1]?.result||[]);
}
function rowsToMap(rows=[]){const map=new Map();for(let i=0;i<rows.length;i+=2)map.set(rows[i],Number(rows[i+1])||0);return map}
async function geoScores(days,dim,value=null){const keys=recentDates(days).map(d=>value?geoArticleKey(d,dim,value):geoKey(d,dim));if(keys.length===1){return rowsToMap(await redis(['ZRANGE',keys[0],0,-1,'WITHSCORES']))}const temp=`ba:tmpgeo:${Date.now()}:${Math.random().toString(36).slice(2)}`;const result=await pipeline([['ZUNIONSTORE',temp,keys.length,...keys],['ZRANGE',temp,0,-1,'WITHSCORES'],['DEL',temp]]);return rowsToMap(result?.[1]?.result||[])}

export async function getPopularArticles(items,days=7,limit=10){if(!analyticsConfigured())return [];const scores=await windowScores(days);return items.filter(a=>scores.has(a.id)).map(a=>({...a,views:scores.get(a.id)||0})).sort((a,b)=>b.views-a.views).slice(0,limit)}

export async function getAnalyticsSummary(items,days=7){if(!analyticsConfigured())return {configured:false,totalViews:0,todayViews:0,views7d:0,views30d:0,topArticles:[],topCategories:[],topCountries:[],topRegions:[],topCities:[]};const [all,today,seven,thirty,countries,regions,cities]=await Promise.all([windowScores(35),windowScores(1),windowScores(7),windowScores(30),geoScores(30,'country'),geoScores(30,'region'),geoScores(30,'city')]);const topArticles=[...seven.entries()].map(([id,views])=>{const a=items.find(x=>x.id===id);return a?{...a,views}:null}).filter(Boolean).sort((a,b)=>b.views-a.views).slice(0,10);const categoryMap=new Map();for(const a of items){const views=seven.get(a.id)||0;if(views)categoryMap.set(a.category||'Tanpa Kategori',(categoryMap.get(a.category||'Tanpa Kategori')||0)+views)}const topCategories=[...categoryMap.entries()].map(([name,views])=>({name,views})).sort((a,b)=>b.views-a.views).slice(0,10);const topN=map=>[...map.entries()].map(([name,views])=>({name,views})).sort((a,b)=>b.views-a.views).slice(0,10);return {configured:true,totalViews:[...all.values()].reduce((s,v)=>s+v,0),todayViews:[...today.values()].reduce((s,v)=>s+v,0),views7d:[...seven.values()].reduce((s,v)=>s+v,0),views30d:[...thirty.values()].reduce((s,v)=>s+v,0),topArticles,topCategories,topCountries:topN(countries),topRegions:topN(regions),topCities:topN(cities)}}

export async function queryAnalytics(items,{days=7,category='',source='',country='',region='',city='',minViews=0,maxViews=Infinity,sort='views'}={}){if(!analyticsConfigured())return {configured:false,items:[]};const scores=await windowScores(days);let locationScores=null;if(country)locationScores=await geoScores(days,'country',country);else if(region)locationScores=await geoScores(days,'region',region);else if(city)locationScores=await geoScores(days,'city',city);let rows=items.map(a=>({...a,views:locationScores?locationScores.get(a.id)||0:scores.get(a.id)||0})).filter(a=>(!category||a.category===category)&&(!source||a.sourceName===source)&&a.views>=minViews&&a.views<=maxViews);rows.sort(sort==='title'?(a,b)=>a.title.localeCompare(b.title):sort==='oldest'?(a,b)=>Date.parse(a.publishedAt||a.createdAt)-Date.parse(b.publishedAt||b.createdAt):sort==='newest'?(a,b)=>Date.parse(b.publishedAt||b.createdAt)-Date.parse(a.publishedAt||a.createdAt):(a,b)=>b.views-a.views);return {configured:true,items:rows};}
