import {fetchSourceMaterial} from '../worker/source-material.js';
import {cleanExcerpt} from './text.js';

const DEFAULT_GEMINI_MODEL='gemini-2.5-flash-lite';
const DEFAULT_OPENAI_MODEL='gpt-4o-mini';
const AI_TIMEOUT_MS=18000;

function cleanText(value=''){
  return String(value)
    .replace(/```(?:json)?/gi,'')
    .replace(/```/g,'')
    .replace(/\.{3,}/g,'')
    .replace(/^[\s]*(?:berikut(?: adalah)?|ini(?: adalah)?)[\s,:-]*/i,'')
    .replace(/[ \t]+\n/g,'\n')
    .trim();
}

function parseJsonText(value=''){
  const cleaned=cleanText(value);
  if(!cleaned)return null;
  try{return JSON.parse(cleaned)}catch{}
  const start=cleaned.indexOf('{');
  const end=cleaned.lastIndexOf('}');
  if(start>=0&&end>start){try{return JSON.parse(cleaned.slice(start,end+1))}catch{}}
  return null;
}

function paragraphList(value=''){
  return String(value).split(/\n{2,}/).map(x=>cleanText(x)).filter(x=>x.length>=40);
}

function normalized(value=''){
  return cleanText(value).toLowerCase().replace(/\s+/g,' ');
}

function validateOutput(output,material=''){
  const title=cleanText(output?.title||'');
  const excerpt=cleanText(output?.excerpt||'');
  const content=cleanText(output?.content||'');
  const sourceText=String(material||'').trim();
  const paragraphs=paragraphList(content);
  const minParagraphs=sourceText.length>=1600?5:sourceText.length>=700?3:2;
  const minLength=Math.max(320,Math.min(1800,sourceText.length*.25));
  if(!title||!excerpt||!content)throw new Error('invalid_response');
  if(content.length<minLength)throw new Error('content_too_short');
  if(paragraphs.length<minParagraphs)throw new Error('insufficient_paragraphs');
  if(/\.{3,}|\bplaceholder\b|\[insert\]|<PLACEHOLDER>/i.test(`${title}\n${excerpt}\n${content}`))throw new Error('invalid_response');
  const sourceNormalized=normalized(sourceText);
  const contentNormalized=normalized(content);
  if(sourceNormalized&&contentNormalized===sourceNormalized)throw new Error('copied_source_material');
  return {title,excerpt,content};
}

function fallback(item,material=''){
  const sourceParagraphs=paragraphList(material).slice(0,8);
  const summary=cleanText(item.summary||item.title||'');
  const body=[];
  if(summary&&summary.length>=40)body.push(summary);
  for(const paragraph of sourceParagraphs){
    if(!body.some(existing=>normalized(existing)===normalized(paragraph)))body.push(paragraph);
  }
  if(!body.length)body.push(cleanText(item.title||'Berita terbaru'));
  body.push(`Sumber: ${item.sourceName||'sumber publik'}${item.url?` — ${item.url}`:''}`);
  return {title:cleanText(item.title||'Berita terbaru'),excerpt:cleanExcerpt(item.summary||item.title||''),content:body.join('\n\n'),generationProvider:'fallback',generationModel:null,generationAt:new Date().toISOString()};
}

function providerError(provider,error){
  const message=String(error?.message||error||'unknown');
  if(message==='429'||/rate[_ -]?limited|quota/i.test(message))return 'rate_limited';
  if(error?.name==='AbortError'||/timeout|aborted/i.test(message))return 'timeout';
  if(/5\d\d/.test(message)||/server_error/i.test(message))return 'server_error';
  if(/invalid_response|content_too_short|insufficient_paragraphs|copied_source_material/i.test(message))return 'invalid_response';
  return provider==='gemini'?'unavailable':'failed';
}

function buildPrompt(item,material=''){
  return `Anda adalah editor newsroom Berita Auto. Tulis ulang bahan berita berikut menjadi artikel Bahasa Indonesia yang orisinal, natural, profesional, dan faktual. Bahan hanya boleh dipakai sebagai sumber fakta. Ubah lead, struktur kalimat, pilihan kata, dan alur paragraf; jangan sekadar mengganti sinonim. Target 5-8 paragraf bila bahan mencukupi.\n\nJangan menambah fakta yang tidak tersedia. Jangan membuat kutipan langsung, narasumber, reporter, wawancara, saksi mata, lokasi liputan, statistik, angka keuangan, penelitian, jurnal, pernyataan pemerintah, atau kronologi baru. Jangan menulis seolah reporter Berita Auto berada di lokasi atau mewawancarai siapa pun. Kutipan langsung hanya boleh dipakai bila benar-benar ada di bahan sumber; jika ragu, parafrase. Jangan gunakan ellipsis tiga titik. Jangan clickbait. Pertahankan atribusi sumber.\n\nKembalikan JSON terstruktur dengan field title, excerpt, content. Field content berisi paragraf lengkap dipisahkan oleh dua newline. Jangan mengembalikan markdown fence, pengantar, komentar, atau field tambahan.\n\nJudul sumber: ${item.title||''}\nRingkasan RSS: ${item.summary||''}\nNama sumber: ${item.sourceName||''}\nURL sumber: ${item.url||''}\nBahan faktual:\n${material||item.summary||item.title||''}`;
}

async function requestWithTimeout(url,options){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),AI_TIMEOUT_MS);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}

async function generateGemini(item,material){
  const key=process.env.GEMINI_API_KEY;
  if(!key)return null;
  const model=process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL;
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const payload={contents:[{parts:[{text:buildPrompt(item,material)}]}],generationConfig:{temperature:0.15,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{title:{type:'STRING'},excerpt:{type:'STRING'},content:{type:'STRING'}},required:['title','excerpt','content']}}};
  const res=await requestWithTimeout(url,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify(payload)});
  if(!res.ok)throw new Error(String(res.status));
  const data=await res.json();
  const text=data.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('')||'';
  const parsed=parseJsonText(text);
  if(!parsed)throw new Error('invalid_response');
  const validated=validateOutput(parsed,material);
  return {...validated,generationProvider:'gemini',generationModel:model,generationAt:new Date().toISOString()};
}

async function generateOpenAI(item,material){
  const key=process.env.OPENAI_API_KEY;
  if(!key)return null;
  const model=process.env.OPENAI_MODEL||DEFAULT_OPENAI_MODEL;
  const payload={model,messages:[{role:'user',content:buildPrompt(item,material)}],temperature:0.15,response_format:{type:'json_object'}};
  const res=await requestWithTimeout('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify(payload)});
  if(!res.ok)throw new Error(String(res.status));
  const data=await res.json();
  const parsed=parseJsonText(data.choices?.[0]?.message?.content||'');
  if(!parsed)throw new Error('invalid_response');
  const validated=validateOutput(parsed,material);
  return {...validated,generationProvider:'openai',generationModel:model,generationAt:new Date().toISOString()};
}

async function tryProvider(name,fn,item,material){
  try{const result=await fn(item,material);if(result){console.log(`[ai] provider=${name} status=success model=${result.generationModel}`);return result}return null}catch(error){console.warn(`[ai] provider=${name} status=${providerError(name,error)}`);return null}
}

export function getAIProviderConfig(){return{primary:'gemini',gemini:{configured:Boolean(process.env.GEMINI_API_KEY),model:process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL},openai:{configured:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_MODEL||DEFAULT_OPENAI_MODEL},cloudflare:{configured:false,implemented:false}}}

export async function generateArticle(item,materialArg=''){
  const material=materialArg||await fetchSourceMaterial(item);
  const gemini=await tryProvider('gemini',generateGemini,item,material);if(gemini)return gemini;
  const openai=await tryProvider('openai',generateOpenAI,item,material);if(openai)return openai;
  const result=fallback(item,material);console.warn('[ai] provider=fallback status=used');return result;
}
