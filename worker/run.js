import {fetchNews} from '../lib/rss.js';
import {generateArticle} from '../lib/ai.js';
import {readArticles,writeArticles} from '../lib/storage.js';
import {categories} from '../lib/categories.js';
import {fingerprint} from '../lib/hash.js';
const existing=await readArticles();const seen=new Set(existing.map(a=>a.fingerprint));const fresh=[];for(const item of await fetchNews()){const fp=fingerprint((item.url||item.title).toLowerCase());if(seen.has(fp))continue;const ai=await generateArticle(item);fresh.push({id:fp,...item,...ai,category:categories[0],fingerprint:fp,createdAt:new Date().toISOString()});if(fresh.length>=3)break;}await writeArticles([...fresh,...existing].slice(0,200));console.log(`added ${fresh.length} articles`);
