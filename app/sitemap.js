import {readArticles} from '../lib/storage.js';
import {categories} from '../lib/categories.js';
import {articlePath} from '../lib/article-url.js';
export const dynamic='force-dynamic';
const publicBase='https://berita-auto.vercel.app';
const published=a=>Boolean(a&&a.id&&a.title&&String(a.content||'').trim()&&String(a.translationStatus||'translated')!=='pending'&&String(a.language||'id').toLowerCase()==='id');
const latestDate=items=>items.reduce((max,a)=>{const t=new Date(a.updatedAt||a.sitePublishedAt||a.createdAt).getTime();return Number.isFinite(t)&&t>max?t:max},0);
export default async function sitemap(){const articles=(await readArticles()).filter(published);const categoryRows=categories.map(name=>({name,latest:latestDate(articles.filter(a=>String(a.category||'').toLowerCase()===name.toLowerCase()))})).filter(x=>x.latest>0);const items=[{url:publicBase,lastModified:latestDate(articles)?new Date(latestDate(articles)):undefined},{url:`${publicBase}/kategori/nasional`,lastModified:new Date(categoryRows.find(x=>x.name==='Nasional')?.latest||latestDate(articles))},...categoryRows.filter(x=>x.name!=='Nasional').map(x=>({url:`${publicBase}/kategori/${x.name.toLowerCase()}`,lastModified:new Date(x.latest)})),...articles.map(a=>({url:`${publicBase}${articlePath(a)}`,lastModified:new Date(latestDate([a]))}))];return items}
