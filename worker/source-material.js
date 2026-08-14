function decode(value=''){
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi,'\n')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))
    .replace(/\r/g,'').replace(/[ \t]+/g,' ')
    .replace(/\n\s+/g,'\n').replace(/\n{3,}/g,'\n\n')
    .trim();
}

export async function fetchSourceMaterial(item){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(item.url,{signal:controller.signal,headers:{'user-agent':'BeritaAuto/1.2','accept':'text/html,application/xhtml+xml'}});
    if(!response.ok)throw new Error(`source ${response.status}`);
    const html=await response.text();
    const paragraphs=[];
    const matches=html.match(/<(?:article|main|section)[^>]*>[\s\S]*?<\/(?:article|main|section)>/gi)||[];
    const regions=matches.length?matches:[html];
    for(const region of regions){
      const ps=region.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)||[];
      for(const p of ps){
        const text=decode(p);
        if(text.length>=80&&!/^sumber[:\s]/i.test(text)&&!/^baca juga/i.test(text))paragraphs.push(text);
      }
      if(paragraphs.length>=12)break;
    }
    const material=paragraphs.slice(0,12).join('\n\n').slice(0,14000);
    return material||'';
  }catch(error){
    console.warn(`[source] material unavailable for ${item.title}: ${error.message}`);
    return '';
  }finally{clearTimeout(timer);}
}
