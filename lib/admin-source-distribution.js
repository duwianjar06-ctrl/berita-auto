const UNKNOWN_SOURCE='Sumber tidak diketahui';

function articleTimestamp(article){
  const value=article?.sitePublishedAt||article?.createdAt||article?.publishedAt;
  const time=value?new Date(value).getTime():NaN;
  return Number.isNaN(time)?0:time;
}

export function buildSourceDistribution(items=[]){
  const total=items.length;
  const bySource=new Map();
  for(const article of items){
    const name=String(article?.sourceName||'').trim()||UNKNOWN_SOURCE;
    let row=bySource.get(name);
    if(!row){row={name,count:0,latestAt:0,categories:new Map()};bySource.set(name,row)}
    row.count+=1;
    const timestamp=articleTimestamp(article);
    if(timestamp>row.latestAt)row.latestAt=timestamp;
    const category=String(article?.category||'').trim()||'Tanpa Kategori';
    row.categories.set(category,(row.categories.get(category)||0)+1);
  }
  return [...bySource.values()].map(row=>{
    const dominantCategory=[...row.categories.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
    return {name:row.name,count:row.count,percentage:total?row.count/total*100:0,latestAt:row.latestAt,dominantCategory:dominantCategory?.[0]||'Tanpa Kategori'};
  }).sort((a,b)=>b.count-a.count||b.latestAt-a.latestAt||a.name.localeCompare(b.name));
}

export {UNKNOWN_SOURCE};
