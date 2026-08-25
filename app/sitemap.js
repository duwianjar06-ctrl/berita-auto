import {readPublicArticles} from '../lib/public-data.js';
import {listPublishedArticles} from '../lib/article-storage.js';
import {categories} from '../lib/categories.js';
import {articlePath,isArticleRouteResolvable} from '../lib/article-url.js';
import {isIndexableArticle} from '../lib/article-seo.js';
export const dynamic='force-dynamic';
const publicBase='https://berita-auto.vercel.app';
const categorySlug=name=>encodeURIComponent(String(name).toLowerCase());
const latestDate=items=>items.reduce((max,a)=>{const t=new Date(a.updatedAt||a.sitePublishedAt||a.createdAt).getTime();return Number.isFinite(t)&&t>max?t:max},0);
const sitemapEligible=a=>isIndexableArticle(a)&&a.id&&a.title&&String(a.content||'').trim()&&isArticleRouteResolvable(a);
export default async function sitemap(){const news=(await readPublicArticles()).filter(sitemapEligible);const evergreen=await listPublishedArticles();const siteLatest=Math.max(latestDate(news),latestDate(evergreen));const home={url:publicBase,...(siteLatest?{lastModified:new Date(siteLatest)}:{})};const categoriesItems=categories.map(name=>{const latest=latestDate(news.filter(a=>String(a.category||'').toLowerCase()===name.toLowerCase()));return{url:`${publicBase}/kategori/${categorySlug(name)}`,...(latest?{lastModified:new Date(latest)}:{})}});const newsItems=news.map(a=>{const item={url:`${publicBase}${articlePath(a)}`,lastModified:new Date(latestDate([a]))};console.log('[SITEMAP_INCLUDED]',JSON.stringify({articleId:a.id,url:item.url}));return item});const evergreenItems=evergreen.map(a=>{const item={url:`${publicBase}/artikel/${a.slug}`,lastModified:new Date(a.updatedAt||a.createdAt)};console.log('[SITEMAP_INCLUDED]',JSON.stringify({articleId:a.id,url:item.url}));return item});console.log('[SITEMAP_RECHECKED]',JSON.stringify({news:newsItems.length,evergreen:evergreenItems.length}));return[home,...categoriesItems,...newsItems,...evergreenItems]}
