import {readPublicArticles} from '../lib/public-data.js';
import {categories} from '../lib/categories.js';
import {articlePath,isArticleRouteResolvable} from '../lib/article-url.js';
import {isIndexableArticle} from '../lib/article-seo.js';
export const dynamic='force-dynamic';
const publicBase='https://berita-auto.vercel.app';
const categorySlug=name=>encodeURIComponent(String(name).toLowerCase());
const latestDate=items=>items.reduce((max,a)=>{const t=new Date(a.updatedAt||a.sitePublishedAt||a.createdAt).getTime();return Number.isFinite(t)&&t>max?t:max},0);
const sitemapEligible=a=>isIndexableArticle(a)&&a.id&&a.title&&String(a.content||'').trim()&&isArticleRouteResolvable(a);
export default async function sitemap(){const articles=(await readPublicArticles()).filter(sitemapEligible);const siteLatest=latestDate(articles);const home={url:publicBase,...(siteLatest?{lastModified:new Date(siteLatest)}:{})};const items=[home,...categories.map(name=>{const latest=latestDate(articles.filter(a=>String(a.category||'').toLowerCase()===name.toLowerCase()));return{url:`${publicBase}/kategori/${categorySlug(name)}`,...(latest?{lastModified:new Date(latest)}:{})}}),...articles.map(a=>({url:`${publicBase}${articlePath(a)}`,lastModified:new Date(latestDate([a]))}))];return items}
