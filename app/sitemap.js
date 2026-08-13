import {readArticles} from '../lib/storage.js';
import {articlePath} from '../lib/article-url.js';
import {categories} from '../lib/categories.js';
export const dynamic='force-dynamic';
export default async function sitemap(){const base='https://berita-auto.vercel.app';const articles=await readArticles();return [{url:base,lastModified:new Date() },...categories.map(c=>({url:`${base}/kategori/${c.toLowerCase()}`,lastModified:new Date()})),...articles.map(a=>({url:`${base}${articlePath(a)}`,lastModified:a.publishedAt||a.createdAt}))]}
