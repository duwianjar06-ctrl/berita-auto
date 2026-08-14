import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {slugify} from './article-url.js';
const articlesPath=join(process.cwd(),'data','articles.json');
const pendingPath=join(process.cwd(),'data','pending-articles.json');
const remoteBase='https://raw.githubusercontent.com/projectdaaw-bot/berita-auto/feature/auto-news-mvp/data/';
const apiBase='https://api.github.com/repos/projectdaaw-bot/berita-auto/contents/data/';
const hydrate=a=>Array.isArray(a)?a.map(x=>x.slug?x:{...x,slug:slugify(x.title||'artikel')}):[];
async function readJson(path,fallback=[]){try{return hydrate(JSON.parse(await readFile(path,'utf8')))}catch{return fallback}}
async function readRemote(name){
  const cacheBust=Date.now();
  try{
    const response=await fetch(`${remoteBase}${name}?v=${cacheBust}`,{cache:'no-store',redirect:'follow',headers:{accept:'application/json','cache-control':'no-cache'}});
    if(response.ok)return hydrate(await response.json());
    throw new Error(`raw ${name} ${response.status}`);
  }catch(rawError){
    const response=await fetch(`${apiBase}${name}?ref=feature%2Fauto-news-mvp&v=${cacheBust}`,{cache:'no-store',redirect:'follow',headers:{accept:'application/vnd.github+json','cache-control':'no-cache'}});
    if(!response.ok)throw new Error(`remote ${name} raw=${rawError.message} api=${response.status}`);
    const payload=await response.json();
    if(payload.encoding!=='base64'||!payload.content)throw new Error(`remote ${name} invalid_api_payload`);
    return hydrate(JSON.parse(Buffer.from(payload.content,'base64').toString('utf8')));
  }
}
export async function readArticles(){if(process.env.VERCEL)return readRemote('articles.json');return readJson(articlesPath)}
export async function writeArticles(items){await writeFile(articlesPath,JSON.stringify(hydrate(items),null,2)+'\n','utf8')}
export async function readPending(){if(process.env.VERCEL)return readRemote('pending-articles.json');return readJson(pendingPath)}
export async function writePending(items){await writeFile(pendingPath,JSON.stringify(Array.isArray(items)?items:[],null,2)+'\n','utf8')}
