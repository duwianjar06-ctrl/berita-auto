import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {slugify} from './article-url.js';
import {persistenceConfigured,getJson,setJson} from './persistence.js';
import {queueSocialArticle} from './social.js';

const articlesPath=join(process.cwd(),'data','articles.json');
const pendingPath=join(process.cwd(),'data','pending-articles.json');
const apiBase='https://api.github.com/repos/projectdaaw-bot/berita-auto/contents/data/';
const ARTICLES_KEY='ba:news:articles';
const PENDING_KEY='ba:news:pending';
const buildPhase=process.env.NEXT_PHASE==='phase-production-build';
const hydrate=a=>Array.isArray(a)?a.map(x=>x.slug?x:{...x,slug:slugify(x.title||'artikel')}):[];
async function readJson(path,fallback=[]){try{return hydrate(JSON.parse(await readFile(path,'utf8')))}catch{return fallback}}
async function readRemote(name){
  const response=await fetch(`${apiBase}${name}?ref=feature%2Fauto-news-mvp`,{cache:'no-store',redirect:'follow',headers:{accept:'application/vnd.github+json','cache-control':'no-cache'}});
  if(!response.ok)throw new Error(`remote ${name} api=${response.status}`);
  const payload=await response.json();
  if(payload.encoding!=='base64'||!payload.content)throw new Error(`remote ${name} invalid_api_payload`);
  return hydrate(JSON.parse(Buffer.from(payload.content,'base64').toString('utf8')));
}
async function ensurePersistent(key,loader,label){
  const current=await getJson(key);
  if(current!==null)return hydrate(current);
  const imported=hydrate(await loader());await setJson(key,imported);console.log(`[storage] migrated ${label} count=${imported.length}`);return imported;
}
export async function readArticles(){
  if(persistenceConfigured())return ensurePersistent(ARTICLES_KEY,async()=>process.env.VERCEL?readRemote('articles.json'):readJson(articlesPath),'articles');
  if(process.env.VERCEL&&!buildPhase)throw new Error('persistent_database_not_configured_for_production');
  return readJson(articlesPath);
}
async function queueSocialNonBlocking(items){
  const candidates=items.filter(item=>item?.id&&item?.sitePublishedAt).slice(0,100);
  const results=await Promise.allSettled(candidates.map(queueSocialArticle));
  const failed=results.filter(x=>x.status==='rejected');
  if(failed.length)console.warn(`[social] queue_noncritical_failures=${failed.length}`);
}
export async function writeArticles(items){
  const normalized=hydrate(items);
  if(persistenceConfigured()){
    await setJson(ARTICLES_KEY,normalized);
    await queueSocialNonBlocking(normalized);
    return normalized;
  }
  await writeFile(articlesPath,JSON.stringify(normalized,null,2)+'\n','utf8');
  await queueSocialNonBlocking(normalized).catch(()=>{});
  return normalized;
}
export async function readPending(){
  if(persistenceConfigured())return ensurePersistent(PENDING_KEY,async()=>process.env.VERCEL?readRemote('pending-articles.json'):readJson(pendingPath),'pending');
  if(process.env.VERCEL&&!buildPhase)throw new Error('persistent_database_not_configured_for_production');
  return readJson(pendingPath);
}
export async function writePending(items){
  const normalized=Array.isArray(items)?items:[];
  if(persistenceConfigured()){await setJson(PENDING_KEY,normalized);return normalized;}
  await writeFile(pendingPath,JSON.stringify(normalized,null,2)+'\n','utf8');return normalized;
}
