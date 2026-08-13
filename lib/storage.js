import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {slugify} from './article-url.js';
const path=join(process.cwd(),'data','articles.json');
const remoteBase='https://raw.githubusercontent.com/projectdaaw-bot/berita-auto/feature/auto-news-mvp/data/articles.json';
const hydrate=a=>Array.isArray(a)?a.map(x=>x.slug?x:{...x,slug:slugify(x.title||'artikel')}):[];
async function readLocalArticles(){try{return hydrate(JSON.parse(await readFile(path,'utf8')))}catch{return []}}
async function readRemoteArticles(){const response=await fetch(`${remoteBase}?v=${Date.now()}`,{cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache'}});if(!response.ok)throw new Error(`remote articles ${response.status}`);return hydrate(await response.json())}
export async function readArticles(){if(process.env.VERCEL){try{return await readRemoteArticles()}catch{return readLocalArticles()}}return readLocalArticles()}
export async function writeArticles(items){await writeFile(path,JSON.stringify(hydrate(items),null,2)+'\n','utf8')}
