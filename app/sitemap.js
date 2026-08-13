import {readArticles} from '../lib/storage.js';
import {categories} from '../lib/categories.js';

const base='https://berita-auto.vercel.app';

export default async function sitemap(){
  const articles=await readArticles();
  const categoryUrls=categories.map(name=>({url:`${base}/kategori/${encodeURIComponent(name.toLowerCase())}`,lastModified:new Date()}));
  const articleUrls=articles.map(a=>({url:`${base}/berita/${a.id}`,lastModified:a.publishedAt||a.createdAt||new Date()}));
  return [{url:base+'/',lastModified:new Date()},...categoryUrls,...articleUrls];
}
