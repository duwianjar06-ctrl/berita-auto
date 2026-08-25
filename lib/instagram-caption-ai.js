import {getProviderRegistry} from './ai-providers.js';

const MAX_BODY=1850;
const TIMEOUT_MS=18000;

function plain(value=''){return String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
function parseJsonText(value=''){
  const text=String(value||'').trim();
  if(!text)return null;
  try{return JSON.parse(text);}catch{}
  const start=text.indexOf('{');const end=text.lastIndexOf('}');
  if(start>=0&&end>start){try{return JSON.parse(text.slice(start,end+1));}catch{}}
  return null;
}
async function requestWithTimeout(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
function buildPrompt(item,material){
  return JSON.stringify({
    system:`Anda adalah editor berita Indonesia untuk Berita Auto. Buat caption Instagram panjang dan lengkap berdasarkan ARTICLE SOURCE dan VERIFIED FACTS. Gunakan HANYA fakta yang tersedia. Jangan membuat nama, angka, tanggal, lokasi, penyebab, kutipan, hasil, atau konteks baru. Jangan melakukan riset eksternal. Parafrase dan jangan menyalin artikel mentah. Jelaskan hampir seluruh inti berita. Gunakan Bahasa Indonesia jurnalistik natural, paragraf pendek, tanpa filler dan tanpa pengulangan. Jangan gunakan markdown. Jangan menulis label seperti Ringkasan atau Fakta. Jangan menulis hashtag atau URL. Return hanya BODY caption. Target 1550-1850 karakter bila source cukup, tetapi jangan memakai filler untuk mengejar panjang.`,
    title:plain(item?.title),category:plain(item?.category),publisher:plain(item?.publisher||item?.sourceName||item?.source),canonicalUrl:plain(item?.canonicalUrl||item?.articleUrl),articleSource:String(material?.articleSource||''),verifiedFacts:material?.verifiedFacts||[]
  });
}

export async function generateInstagramRichParaphrase({article={},verifiedFacts=[],articleSource='',fingerprint=''}){
  const item={...article,fingerprint:fingerprint||article?.id||article?.stableId||''};
  const material={articleSource:String(articleSource||''),verifiedFacts};
  const providers=getProviderRegistry({buildPrompt,parseJsonText,validateOutput:(parsed)=>parsed,requestWithTimeout});
  let lastError=null;
  for(const provider of providers){
    if(!provider.isConfigured())continue;
    try{
      const result=await provider.generate(item,material);
      const body=plain(result?.content||result?.excerpt||'');
      if(body.length<300||body.length>MAX_BODY)throw new Error('caption_body_length_invalid');
      return{body,generationProvider:result.generationProvider||provider.name,generationModel:result.generationModel||provider.modelName,generationAt:result.generationAt||new Date().toISOString(),aiUsed:true,fallbackUsed:false};
    }catch(error){lastError=error;}
  }
  return{body:'',generationProvider:'deterministic-rich',generationModel:null,generationAt:new Date().toISOString(),aiUsed:false,fallbackUsed:true,error:lastError?.message||'no_ai_provider_available'};
}

export function paraphraseOverlapTooHigh(output='',source='',threshold=.72){
  const paragraphs=String(output||'').split(/\n\s*\n/).map(plain).filter(Boolean);
  const sourceSentences=String(source||'').split(/(?<=[.!?])\s+/).map(plain).filter(x=>x.length>50);
  const tokens=value=>new Set(value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(x=>x.length>2));
  const overlap=(a,b)=>{const aa=tokens(a),bb=tokens(b);if(!aa.size||!bb.size)return 0;let n=0;for(const x of aa)if(bb.has(x))n++;return n/Math.max(aa.size,bb.size);};
  return paragraphs.some(p=>sourceSentences.some(s=>overlap(p,s)>=threshold));
}
