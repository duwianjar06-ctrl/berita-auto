import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {slugify} from './article-url.js';
const articlesPath=join(process.cwd(),'data','articles.json');
const pendingPath=join(process.cwd(),'data','pending-articles.json');
const remoteBase='https://raw.githubusercontent.com/projectdaaw-bot/berita-auto/feature/auto-news-mvp/data/';
const hydrate=a=>Array.isArray(a)?a.map(x=>x.slug?x:{...x,slug:slugify(x.title||'artikel')}):[];
async function readJson(path,fallback=[]){try{return hydrate(JSON.parse(await readFile(path,'utf8')))}catch{return fallback}}
async function readRemote(name){const response=await fetch(`${remoteBase}${name}?v=${Date.now()}`,{cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache'}});if(!response.ok)throw new Error(`remote ${name} ${response.status}`);return hydrate(await response.json())}
export async function readArticles(){if(process.env.VERCEL){try{return await readRemote('articles.json')}catch{return readJson(articlesPath)}}return readJson(articlesPath)}
export async function writeArticles(items){await writeFile(articlesPath,JSON.stringify(hydrate(items),null,2)+'\n','utf8')}
export async function readPending(){if(process.env.VERCEL){try{return await readRemote('pending-articles.json')}catch{return readJson(pendingPath)}}return readJson(pendingPath)}
export async function writePending(items){await writeFile(pendingPath,JSON.stringify(Array.isArray(items)?items:[],null,2)+'\n','utf8')}
