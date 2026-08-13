import {sources} from './sources.js';

function clean(value=''){
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/<[^>]*>/g,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/\s+/g,' ').trim();
}
function tag(xml,name){const m=xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`,'i'));return m?clean(m[1]):'';}
export async function fetchNews(){const out=[];for(const url of sources){try{console.log(`[rss] fetching ${url}`);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);const res=await fetch(url,{signal:controller.signal,headers:{'user-agent':'BeritaAuto/1.0'}});clearTimeout(timer);if(!res.ok){console.error(`[rss] ${res.status} ${url}`);continue;}const xml=await res.text();const items=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];console.log(`[rss] ${items.length} items received`);for(const item of items){const title=tag(item,'title');const link=tag(item,'link');if(title&&link)out.push({title,summary:tag(item,'description'),url:link,publishedAt:tag(item,'pubDate'),sourceUrl:url});}}catch(error){console.error(`[rss] source failed ${url}: ${error.message}`);}}return out;}
