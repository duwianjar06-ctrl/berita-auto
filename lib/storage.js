import {readFile,writeFile} from 'node:fs/promises';
const path=new URL('../data/articles.json',import.meta.url);
export async function readArticles(){try{return JSON.parse(await readFile(path,'utf8'));}catch{return [];}}
export async function writeArticles(items){await writeFile(path,JSON.stringify(items,null,2)+'\n','utf8');}
