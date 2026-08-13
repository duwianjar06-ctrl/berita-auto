import {readArticles} from '../lib/storage.js';
export default async function sitemap(){const base='https://berita-auto.vercel.app';const articles=await readArticles();return [{url:base},{url:base+'/kategori/nasional'},...articles.map(a=>({url:`${base}/berita/${a.id}`,lastModified:a.publishedAt||a.createdAt}))]}
