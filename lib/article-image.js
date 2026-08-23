import {put} from '@vercel/blob';
import {ARTICLE_CONFIG} from './article-config.js';

const SITE='https://berita-auto.vercel.app';
const TIMEOUT_MS=30000;

function imageConfig(){return ARTICLE_CONFIG.image}
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function escapeXml(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function safeCode(value,fallback='image_generation_failed'){return String(value||fallback).toLowerCase().replace(/[^a-z0-9_:-]/g,'_').slice(0,100)}

export function wrapTextByWords(text,{maxWidth=1040,maxLines=3,fontSize=46,fontFamilyFactor=.55,ellipsis=true}={}){
 const words=clean(text).split(/\s+/).filter(Boolean);if(!words.length)return[];
 const measure=word=>word.length*fontSize*fontFamilyFactor;
 const lines=[];let current='';
 for(const word of words){const candidate=current?`${current} ${word}`:word;if(current&&measure(candidate)>maxWidth){lines.push(current);current=word}else current=candidate}
 if(current)lines.push(current);
 if(lines.length<=maxLines)return lines;
 const kept=lines.slice(0,maxLines);let remaining=words.join(' ');let used=[];
 for(let i=0;i<maxLines-1;i++){const line=kept[i];used.push(line);remaining=remaining.slice(line.length).trim()}
 let last=remaining.split(/\s+/).filter(Boolean);while(last.length){const candidate=`${last.join(' ')}${ellipsis?'…':''}`;if(measure(candidate)<=maxWidth){kept[maxLines-1]=candidate;return kept}last.pop()}
 return kept.slice(0,maxLines);
}

function titleLines(title,baseSize=46){for(const fontSize of [baseSize,42,38,35,32]){const lines=wrapTextByWords(title,{maxWidth:1040,maxLines:3,fontSize});if(lines.length<=3&&lines.every(x=>x.length>0))return{fontSize,lines}}return{fontSize:32,lines:wrapTextByWords(title,{maxWidth:1040,maxLines:3,fontSize:32})}}

export function buildArticleImagePrompt(article={}){return `Create a professional editorial illustration for an Indonesian evergreen article published by Berita Auto. Subject: ${clean(article.title||article.topic)}. Search intent: ${clean(article.primaryQuery)}. Category: ${clean(article.category||'General')}. Use a realistic, informative visual scene without logos, copyrighted characters, readable text, watermarks, or fabricated product specifications. Make the subject immediately understandable, visually clean, trustworthy, modern newsroom style, natural lighting, wide composition, 16:9.`}

async function request(url,options={}){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);try{return await fetch(url,{...options,signal:controller.signal,cache:'no-store'})}catch(error){if(error?.name==='AbortError')throw new Error('gemini_image_timeout');throw error}finally{clearTimeout(timer)}}

async function generateGemini(prompt,config){const key=String(process.env.GEMINI_API_KEY||'').trim();if(!key)throw new Error('gemini_api_key_missing');
  const response=await request('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({model:config.model,input:prompt,response_format:{type:'image',mime_type:'image/jpeg',aspect_ratio:config.aspectRatio,image_size:'1K'}})});
  const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(`gemini_image_http_${response.status}`);
  const data=payload?.output_image?.data||payload?.steps?.flatMap(step=>Array.isArray(step?.content)?step.content:[]).find(block=>block?.type==='image')?.data;
  if(!data)throw new Error(payload?.status==='failed'?'gemini_image_failed':'gemini_image_missing');
  return{buffer:Buffer.from(data,'base64'),mimeType:'image/jpeg'};
}

export function fallbackSvg(article={},config){const title=clean(article.title||'Artikel Berita Auto');const topic=clean(article.category||'Panduan & Pengetahuan');const {fontSize,lines}=titleLines(title,46);const safeTitle=lines.map(escapeXml).join('');const tspans=lines.map((line,i)=>`<tspan x="80" dy="${i===0?0:Math.round(fontSize*1.28)}">${escapeXml(line)}</tspan>`).join('');return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}"><rect width="100%" height="100%" fill="#101827"/><circle cx="1010" cy="110" r="270" fill="#26354f"/><circle cx="1110" cy="585" r="170" fill="#172338"/><rect x="80" y="86" width="180" height="10" rx="5" fill="#ffffff" opacity=".75"/><text x="80" y="155" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#ffffff">BERITA AUTO</text><text x="80" y="250" font-family="Arial,sans-serif" font-size="22" fill="#b8c7dc">${escapeXml(topic.slice(0,48))}</text><text x="80" y="330" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" style="word-break:normal;overflow-wrap:normal">${tspans}</text><text x="80" y="590" font-family="Arial,sans-serif" font-size="20" fill="#b8c7dc">Panduan &amp; Pengetahuan</text></svg>`,'utf8')}

async function persistImage(buffer,article,config,mimeType='image/jpeg'){if(config.storage!=='blob')throw new Error('unsupported_article_image_storage');if(!String(process.env.BLOB_READ_WRITE_TOKEN||'').trim())throw new Error('blob_token_missing');const slug=clean(article.slug||article.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'artikel';const extension=mimeType==='image/svg+xml'?'svg':'jpg';const version=Date.now();let blob;try{blob=await put(`articles/${slug}-${version}.${extension}`,buffer,{access:'public',contentType:mimeType,addRandomSuffix:true})}catch(error){throw new Error('blob_upload_failed')}if(!blob?.url)throw new Error('blob_url_missing');try{const check=await request(blob.url,{method:'HEAD'});const type=String(check.headers.get('content-type')||'');if(!check.ok)throw new Error('blob_url_unreachable');if(!type.startsWith('image/'))throw new Error('blob_content_type_invalid')}catch(error){if(String(error?.message||'').startsWith('blob_'))throw error;throw new Error('blob_url_validation_failed')}return{url:blob.url,version}}

export async function generateAndPersistArticleImage(article={}){const config=imageConfig();if(!config.enabled)return{status:'disabled',imageStatus:'disabled',imageUrl:null,config};const generatedAt=new Date().toISOString();let generated=null,sourceType='ai_generated',model=config.model,aiGenerationStatus='failed',fallbackStatus='not_attempted',persistenceStatus='failed',imageErrorCode=null;
  if(config.provider==='gemini'){try{generated=await generateGemini(buildArticleImagePrompt(article),config);aiGenerationStatus='success'}catch(error){imageErrorCode=safeCode(error?.message,'gemini_image_failed');if(config.fallback!=='branded')throw error;try{generated={buffer:fallbackSvg(article,config),mimeType:'image/svg+xml'};sourceType='branded_fallback';model='none';fallbackStatus='success'}catch(fallbackError){fallbackStatus='failed';throw Object.assign(new Error('branded_fallback_failed'),{imageErrorCode:'branded_fallback_failed',aiGenerationStatus,fallbackStatus,persistenceStatus})}}}else if(config.fallback==='branded'){generated={buffer:fallbackSvg(article,config),mimeType:'image/svg+xml'};sourceType='branded_fallback';model='none';fallbackStatus='success'}else throw new Error('unsupported_article_image_provider');
  let persisted;try{persisted=await persistImage(generated.buffer,article,config,generated.mimeType);persistenceStatus='success'}catch(error){persistenceStatus='failed';imageErrorCode=imageErrorCode||safeCode(error?.message,'blob_upload_failed');throw Object.assign(new Error(imageErrorCode),{imageErrorCode,aiGenerationStatus,fallbackStatus,persistenceStatus})}
  return{status:'ready',imageStatus:'ready',imageUrl:persisted.url,imageAlt:clean(article.title||'Artikel Berita Auto'),imageCaption:sourceType==='ai_generated'&&config.disclosure?'Ilustrasi AI — Berita Auto':sourceType==='branded_fallback'?'Ilustrasi Berita Auto':'Foto/Ilustrasi referensi',imageSourceType:sourceType,imageModel:model,imageGeneratedAt:generatedAt,imageGenerationAttemptAt:generatedAt,imageVersion:persisted.version,imageErrorCode:null,aiGenerationStatus,fallbackStatus,persistenceStatus,lastImageAttemptStatus:'success',lastImageErrorCode:null,site:SITE};
}

export {imageConfig,safeCode};
