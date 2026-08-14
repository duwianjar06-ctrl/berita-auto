import {readArticles} from '../lib/storage.js';
import {articlePath} from '../lib/article-url.js';
import {categories} from '../lib/categories.js';

export const dynamic='force-dynamic';
const base='https://berita-auto.vercel.app';
function latest(items){return items.reduce((best,item)=>{const value=Date.parse(item.updatedAt||item.sitePublishedAt||item.publishedAt||item.createdAt||'');const current=best?Date.parse(best.updatedAt||best.sitePublishedAt||best.publishedAt||best.createdAt||''):0;return Number.isFinite(value)&&value>current?item:best},null)}
export default async function sitemap(){
  const articles=await readArticles();
  const published=articles.filter(a=>a&&a.fingerprint&&a.title&&a.content);
  const siteLatest=latest(published);
  const categoryUrls=categories.map(name=>{const latestCategory=latest(published.filter(a=>(a.category||'').toLowerCase()===name.toLowerCase()));return {url:`${base}/kategori/${name.toLowerCase()}`,lastModified:latestCategory?.updatedAt||latestCategory?.sitePublishedAt||latestCategory?.publishedAt||siteLatest?.sitePublishedAt||new Date('2026-01-01T00:00:00Z')}});
  const articleUrls=published.map(a=>({url:`${base}${articlePath(a)}`,lastModified:a.updatedAt||a.sitePublishedAt||a.publishedAt||a.createdAt}));
  return [{url:base,lastModified:siteLatest?.updatedAt||siteLatest?.sitePublishedAt||siteLatest?.publishedAt||new Date('2026-01-01T00:00:00Z')},...categoryUrls,...articleUrls];
}
