import {fetchNews} from '../lib/rss.js';
import {generateArticle} from '../lib/ai.js';
import {readArticles,writeArticles} from '../lib/storage.js';
import {fingerprint} from '../lib/hash.js';
const category=t=>/ai|teknologi|gadget|software/i.test(t)?'Teknologi':/ekonomi|saham|rupiah|bisnis/i.test(t)?'Ekonomi':/bola|olahraga|liga|timnas/i.test(t)?'Olahraga':/film|musik|artis|seleb/i.test(t)?'Hiburan':/mobil|motor|otomotif/i.test(t)?'Otomotif':'Nasional';
const existing=await readArticles();const seen=new Set(existing.map(a=>a.fingerprint));const fresh=[];for(const item of await fetchNews()){const fp=fingerprint((item.url||item.title).toLowerCase());if(seen.has(fp))continue;const ai=await generateArticle(item);fresh.push({id:fp,...item,...ai,category:category(item.title),fingerprint:fp,createdAt:new Date().toISOString()});if(fresh.length>=3)break;}await writeArticles([...fresh,...existing].slice(0,200));console.log(`added ${fresh.length} articles`);
