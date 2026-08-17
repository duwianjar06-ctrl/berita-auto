import {mgetJson,msetJson,sortedAddMany} from './persistence.js';

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const publishedKey=id=>`ba:social:instagram:published:${id}`;
const itemKey=id=>`ba:social:instagram:item:${id}`;

export async function queueSocialArticles(articles,{now=new Date().toISOString(),siteUrl=null}={}){
  const source=(Array.isArray(articles)?articles:[]).filter(article=>article?.id&&article?.sitePublishedAt).slice(0,100);
  if(!source.length)return[];
  const unique=[];const seen=new Set();
  for(const article of source){const id=String(article.id);if(seen.has(id))continue;seen.add(id);unique.push(article);}
  const ids=unique.map(article=>String(article.id));
  const keys=[...ids.map(publishedKey),...ids.map(itemKey)];
  const stored=await mgetJson(keys);
  const published=stored.slice(0,ids.length);const existing=stored.slice(ids.length);
  const entries=[];const indexEntries=[];const result=[];
  for(let i=0;i<unique.length;i++){
    const article=unique[i];
    if(published[i]){result.push({queued:false,reason:'already_published',articleId:ids[i]});continue;}
    const prior=existing[i];
    if(prior?.state==='published'){result.push({queued:false,reason:'already_published',articleId:ids[i]});continue;}
    const createdAt=prior?.createdAt||now;
    const item={...(prior||{}),id:article.id,articleId:article.id,platform:'instagram',article,state:'queued',attempts:Number(prior?.attempts)||0,lastError:prior?.lastError||null,createdAt,updatedAt:now,nextRetryAt:null};
    entries.push([itemKey(ids[i]),item]);
    indexEntries.push({index:'ba:social:instagram:queue',score:-Date.parse(createdAt),id:itemKey(ids[i])});
    result.push({queued:true,item});
  }
  if(entries.length)await msetJson(entries);
  if(indexEntries.length)await sortedAddMany(indexEntries);
  return result;
}

export const socialQueueBatchDiagnostics={version:1,description:'Batch social queue admission uses one MGET, one MSET and one ZADD for concurrent article admission.'};
