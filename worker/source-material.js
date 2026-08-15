function decode(value=''){
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi,'\n')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))
    .replace(/\r/g,'').replace(/[ \t]+/g,' ')
    .replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n')
    .trim();
}
function cleanParagraph(value=''){
  const text=decode(value).replace(/\s+/g,' ').trim();
  if(text.length<70)return '';
  if(/^(?:baca juga|selengkapnya|subscribe|berlangganan|newsletter|ikuti kami|share|bagikan|advertisement|iklan|copyright|all rights reserved)\b/i.test(text))return '';
  if(/^(?:temukan lebih banyak|rekomendasi|berita terkait|artikel terkait)\b/i.test(text))return '';
  return text;
}
function uniqueParagraphs(values){const seen=new Set();const out=[];for(const value of values){const text=cleanParagraph(value);if(!text)continue;const key=text.toLowerCase().replace(/\W+/g,' ').trim();if(seen.has(key))continue;seen.add(key);out.push(text);}return out;}
function jsonLdBodies(html){const out=[];const scripts=html.match(/<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>[\s\S]*?<\/script>/gi)||[];for(const script of scripts){const raw=script.replace(/^<script[^>]*>/i,'').replace(/<\/script>$/i,'').trim();try{const parsed=JSON.parse(raw);const nodes=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.['@graph'])?parsed['@graph']:[parsed]);for(const node of nodes){if(typeof node?.articleBody==='string')out.push(node.articleBody);}}catch{}}return out;}
function htmlParagraphs(html){const selectors=[/<article\b[^>]*>[\s\S]*?<\/article>/gi,/<main\b[^>]*>[\s\S]*?<\/main>/gi,/<(?:div|section)\b[^>]*(?:class|id)=[\"'][^\"']*(?:article|story|content|body|post)[^\"']*[\"'][^>]*>[\s\S]*?<\/(?:div|section)>/gi];const regions=[];for(const re of selectors)regions.push(...(html.match(re)||[]));const sourceRegions=regions.length?regions:[html];const values=[];for(const region of sourceRegions){const ps=region.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)||[];values.push(...ps);if(values.length>=40)break;}return uniqueParagraphs(values);}
export async function fetchSourceMaterial(item){
  const started=Date.now();
  const rssMaterial=uniqueParagraphs(String(item.sourceMaterial||'').split(/\n{2,}/));
  if(rssMaterial.length>=2){const material=rssMaterial.slice(0,24).join('\n\n').slice(0,28000);console.log(`[content] publisher=${item.publisher||item.sourceName||'unknown'} sourceChars=${material.length} sourceWords=${material.split(/\s+/).filter(Boolean).length} sourceParagraphs=${rssMaterial.length} status=rss_content`);return material;}
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
  try{const response=await fetch(item.url,{signal:controller.signal,headers:{'user-agent':'BeritaAuto/1.3','accept':'text/html,application/xhtml+xml'}});if(!response.ok)throw new Error(`source ${response.status}`);const html=await response.text();const structured=uniqueParagraphs(jsonLdBodies(html));const paragraphs=structured.length>=3?structured:htmlParagraphs(html);const material=paragraphs.slice(0,24).join('\n\n').slice(0,28000);const words=material?material.split(/\s+/).filter(Boolean).length:0;console.log(`[content] publisher=${item.publisher||item.sourceName||'unknown'} sourceChars=${material.length} sourceWords=${words} sourceParagraphs=${paragraphs.length} status=${material?'success':'empty'}`);return material||'';}catch(error){console.warn(`[content] publisher=${item.publisher||item.sourceName||'unknown'} status=unavailable reason=${String(error?.message||error).slice(0,120)}`);return '';}finally{clearTimeout(timer);}
}
