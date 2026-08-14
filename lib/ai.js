import {fetchSourceMaterial} from '../worker/source-material.js';

function cleanText(value=''){
  return String(value).replace(/```(?:json)?/gi,'').replace(/```/g,'').replace(/\.{3,}/g,'.').replace(/[ \t]+\n/g,'\n').trim();
}
function fallback(item,material=''){
  const body=(material||item.summary||item.title||'').trim();
  return {title:item.title,excerpt:(item.summary||item.title||'').trim(),content:`${body}\n\nSumber: ${item.sourceName||'sumber publik'} — ${item.url}`};
}

export async function generateArticle(item,materialArg=''){
  const key=process.env.OPENAI_API_KEY;
  const material=materialArg||await fetchSourceMaterial(item);
  if(!key)return fallback(item,material);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const model=process.env.OPENAI_MODEL||'gpt-4o-mini';
    const facts=material||item.summary||item.title||'';
    const prompt=`Anda adalah editor newsroom Berita Auto. Tulis ulang bahan berita berikut menjadi artikel Bahasa Indonesia yang orisinal dan faktual. Bahan hanya boleh dipakai sebagai sumber fakta. Jangan copy-paste panjang. Ubah struktur kalimat, lead, dan alur paragraf. Jangan menambah fakta yang tidak ada di bahan. Jangan membuat kutipan langsung, narasumber, angka, lokasi liputan, wawancara, statistik, atau detail baru. Jika sebuah fakta tidak tersedia, jangan mengisinya dengan tebakan. Bila bahan memiliki kutipan langsung, Anda boleh mempertahankan maknanya secara tidak langsung; jangan membuat kutipan baru. Gunakan gaya jurnalistik profesional, natural, tidak clickbait. Target 5-8 paragraf bila bahan mencukupi. Jangan gunakan ellipsis tiga titik. Sumber harus disebut secara wajar, sekali atau dua kali bila relevan.

Kembalikan JSON valid saja dengan tiga field: title, excerpt, content. Field content harus berisi seluruh paragraf dipisahkan oleh dua newline.

Judul sumber: ${item.title}
Ringkasan RSS: ${item.summary||''}
Nama sumber: ${item.sourceName||''}
URL sumber: ${item.url}
Bahan artikel:
${facts}`;
    const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:.15,response_format:{type:'json_object'}),signal:controller.signal});
    if(!res.ok)throw new Error(`AI request failed: ${res.status}`);
    const data=await res.json();
    const parsed=JSON.parse(data.choices?.[0]?.message?.content||'{}');
    const title=cleanText(parsed.title||item.title);
    const excerpt=cleanText(parsed.excerpt||item.summary||item.title);
    const content=cleanText(parsed.content||'');
    if(!content||content.length<Math.max(220,(material||item.summary||'').length*.45))throw new Error('AI content too short');
    return {title,excerpt,content};
  }catch(error){console.error(`[ai] fallback: ${error.message}`);return fallback(item,material)}finally{clearTimeout(timer);}
}
