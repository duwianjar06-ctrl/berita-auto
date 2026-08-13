import {sources} from './sources.js';
function text(xml,tag){const m=xml.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)</'+tag+'>','i'));return m?m[1].replace(/<![CDATA[\\s\\S]*?]]>/g,'').replace(/<[^>]+>/g,'').trim():'';}
export async function fetchNews(){const out=[];for(const url of sources){const res=await fetch(url);if(!res.ok)continue;const xml=await res.text();for(const item of xml.match(/<item>[\\s\\S]*?<\\/item>/gi)||[]){out.push({title:text(item,'title'),summary:text(item,'description'),url:text(item,'link'),publishedAt:text(item,'pubDate')});}}return out.filter(x=>x.title&&x.url);}
