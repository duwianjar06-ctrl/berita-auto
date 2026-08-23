import {put} from '@vercel/blob';
import {ARTICLE_CONFIG} from './article-config.js';

const SITE='https://berita-auto.vercel.app';
const TIMEOUT_MS=30000;

function imageConfig(){return ARTICLE_CONFIG.image}
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function safeCode(value,fallback='image_generation_failed'){return String(value||fallback).toLowerCase().replace(/[^a-z0-9_:-]/g,'_').slice(0,100)}

export function buildArticleImagePrompt(article={}){return `Create a professional editorial illustration for an Indonesian evergreen article published by Berita Auto. Subject: ${clean(article.title||article.topic)}. Search intent: ${clean(article.primaryQuery)}. Category: ${clean(article.category||'General')}. Use a realistic, informative visual scene without logos, copyrighted characters, readable text, watermarks, or fabricated product specifications. Make the subject immediately understandable, visually clean, trustworthy, modern newsroom style, natural lighting, wide composition, 16:9.`}

async function request(url,options={}){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);try{return await fetch(url,{...options,signal:controller.signal,cache:'no-store'})}catch(error){if(error?.name==='AbortError')throw new Error('gemini_image_timeout');throw error}finally{clearTimeout(timer)}}

async function generateGemini(prompt,config){const key=String(process.env.GEMINI_API_KEY||'').trim();if(!key)throw new Error('gemini_api_key_missing');
  const response=await request('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({model:config.model,input:prompt,response_format:{type:'image',mime_type:'image/jpeg',aspect_ratio:config.aspectRatio,image_size:'1K'}})});
  const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(`gemini_image_http_${response.status}`);
  const data=payload?.output_image?.data||payload?.steps?.flatMap(step=>Array.isArray(step?.content)?step.content:[]).find(block=>block?.type==='image')?.data;
  if(!data)throw new Error(payload?.status==='failed'?'gemini_image_failed':'gemini_image_missing');
  return{buffer:Buffer.from(data,'base64'),mimeType:'image/jpeg'};
}

function fallbackSvg(article={},config){const title=clean(article.title||'Artikel Berita Auto').slice(0,90).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const topic=clean(article.category||'Panduan & Pengetahuan').slice(0,48).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}"><rect width="100%" height="100%" fill="#101827"/><circle cx="980" cy="100" r="260" fill="#26354f"/><rect x="80" y="90" width="180" height="10" rx="5" fill="#ffffff" opacity=".75"/><text x="80" y="155" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#ffffff">BERITA AUTO</text><text x="80" y="250" font-family="Arial,sans-serif" font-size="22" fill="#b8c7dc">${topic}</text><text x="80" y="330" font-family="Arial,sans-serif" font-size="46" font-weight="700" fill="#ffffff"><tspan x="80" dy="0">${title.slice(0,46)}</tspan><tspan x="80" dy="60">${title.slice(46)}</tspan></text><text x="80" y="590" font-family="Arial,sans-serif" font-size="20" fill="#b8c7dc">Panduan &amp; Pengetahuan</text></svg>`,'utf8')}

async function persistImage(buffer,article,config,mimeType='image/jpeg'){if(config.storage!=='blob')throw new Error('unsupported_article_image_storage');if(!String(process.env.BLOB_READ_WRITE_TOKEN||'').trim())throw new Error('blob_token_missing');const slug=clean(article.slug||article.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'artikel';const extension=mimeType==='image/svg+xml'?'svg':'jpg';let blob;try{blob=await put(`articles/${slug}-${Date.now()}.${extension}`,buffer,{access:'public',contentType:mimeType,addRandomSuffix:true})}catch(error){throw new Error('blob_upload_failed')}if(!blob?.url)throw new Error('blob_url_missing');try{const check=await request(blob.url,{method:'HEAD'});const type=String(check.headers.get('content-type')||'');if(!check.ok)throw new Error('blob_url_unreachable');if(!type.startsWith('image/'))throw new Error('blob_content_type_invalid')}catch(error){if(String(error?.message||'').startsWith('blob_'))throw error;throw new Error('blob_url_validation_failed')}return blob.url}

export async function generateAndPersistArticleImage(article={}){const config=imageConfig();if(!config.enabled)return{status:'disabled',imageStatus:'disabled',imageUrl:null,config};const generatedAt=new Date().toISOString();let generated=null,sourceType='ai_generated',model=config.model,aiGenerationStatus='failed',fallbackStatus='not_attempted',persistenceStatus='failed',imageErrorCode=null;
  if(config.provider==='gemini'){try{generated=await generateGemini(buildArticleImagePrompt(article),config);aiGenerationStatus='success'}catch(error){imageErrorCode=safeCode(error?.message,'gemini_image_failed');if(config.fallback!=='branded')throw error;try{generated={buffer:fallbackSvg(article,config),mimeType:'image/svg+xml'};sourceType='branded_fallback';model='none';fallbackStatus='success'}catch(fallbackError){fallbackStatus='failed';throw new Error('branded_fallback_failed')}}}else if(config.fallback==='branded'){generated={buffer:fallbackSvg(article,config),mimeType:'image/svg+xml'};sourceType='branded_fallback';model='none';fallbackStatus='success'}else throw new Error('unsupported_article_image_provider');
  let imageUrl;try{imageUrl=await persistImage(generated.buffer,article,config,generated.mimeType);persistenceStatus='success'}catch(error){persistenceStatus='failed';imageErrorCode=imageErrorCode||safeCode(error?.message,'blob_upload_failed');throw Object.assign(new Error(imageErrorCode),{imageErrorCode,aiGenerationStatus,fallbackStatus,persistenceStatus})}
  return{status:'ready',imageStatus:'ready',imageUrl,imageAlt:clean(article.title||'Artikel Berita Auto'),imageCaption:sourceType==='ai_generated'&&config.disclosure?'Ilustrasi AI — Berita Auto':'Ilustrasi Berita Auto',imageSourceType:sourceType,imageModel:model,imageGeneratedAt:generatedAt,imageErrorCode:null,aiGenerationStatus,fallbackStatus,persistenceStatus,site:SITE};
}

export {imageConfig,fallbackSvg,safeCode};
