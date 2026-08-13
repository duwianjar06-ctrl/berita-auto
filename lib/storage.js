import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const path=join(process.cwd(),'data','articles.json');
const remoteUrl='https://raw.githubusercontent.com/projectdaaw-bot/berita-auto/feature/auto-news-mvp/data/articles.json';
async function readLocalArticles(){try{const data=JSON.parse(await readFile(path,'utf8'));return Array.isArray(data)?data:[];}catch{return [];}}
async function readRemoteArticles(){const response=await fetch(remoteUrl,{cache:'no-store',headers:{accept:'application/json'}});if(!response.ok)throw new Error(`remote articles ${response.status}`);const data=await response.json();if(!Array.isArray(data))throw new Error('remote articles invalid');return data;}
export async function readArticles(){if(process.env.VERCEL){try{return await readRemoteArticles();}catch{return readLocalArticles();}}return readLocalArticles();}
export async function writeArticles(items){await writeFile(path,JSON.stringify(items,null,2)+'\n','utf8');}
