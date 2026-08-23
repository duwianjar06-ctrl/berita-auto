import {put} from '@vercel/blob';

const DEFAULT_MODEL='gemini-3.1-flash-image';
const SITE='https://berita-auto.vercel.app';

function imageConfig(){
  return {
    enabled:String(process.env.ARTICLE_IMAGE_ENABLED||'true').toLowerCase()==='true',
    provider:String(process.env.ARTICLE_IMAGE_PROVIDER||'gemini').toLowerCase(),
    model:String(process.env.ARTICLE_IMAGE_MODEL||DEFAULT_MODEL).trim()||DEFAULT_MODEL,
    aspectRatio:String(process.env.ARTICLE_IMAGE_ASPECT_RATIO||'16:9'),
    width:Number(process.env.ARTICLE_IMAGE_WIDTH||1200),
    height:Number(process.env.ARTICLE_IMAGE_HEIGHT||675),
    storage:String(process.env.ARTICLE_IMAGE_STORAGE||'blob').toLowerCase(),
    fallback:String(process.env.ARTICLE_IMAGE_FALLBACK||'branded').toLowerCase(),
    disclosure:String(process.env.ARTICLE_IMAGE_DISCLOSURE||'true').toLowerCase()==='true'
  };
}

function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}

export function buildArticleImagePrompt(article={}){
  return `Create a professional editorial illustration for an Indonesian evergreen article published by Berita Auto. Subject: ${clean(article.title||article.topic)}. Search intent: ${clean(article.primaryQuery)}. Category: ${clean(article.category||'General')}. Use a realistic, informative visual scene without logos, copyrighted characters, readable text, watermarks, or fabricated product specifications. Make the subject immediately understandable, visually clean, trustworthy, modern newsroom style, natural lighting, wide composition, 16:9.`;
}

async function generateGemini(prompt,config){
  const key=String(process.env.GEMINI_API_KEY||'').trim();
  if(!key)throw new Error('gemini_api_key_missing');
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},
    body:JSON.stringify({model:config.model,input:prompt,response_format:{type:'image',mime_type:'image/jpeg',aspect_ratio:config.aspectRatio,image_size:'1K'}})
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`gemini_image_http_${response.status}`);
  const data=payload?.output_image?.data;
  if(!data)throw new Error('gemini_image_missing');
  return Buffer.from(data,'base64');
}

function fallbackSvg(article={},config){
  const title=clean(article.title||'Artikel Berita Auto').slice(0,90).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const topic=clean(article.category||'Panduan & Pengetahuan').slice(0,48).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}"><rect width="100%" height="100%" fill="#101827"/><circle cx="980" cy="100" r="260" fill="#26354f"/><rect x="80" y="90" width="180" height="10" rx="5" fill="#ffffff" opacity=".75"/><text x="80" y="155" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#ffffff">BERITA AUTO</text><text x="80" y="250" font-family="Arial,sans-serif" font-size="22" fill="#b8c7dc">${topic}</text><text x="80" y="330" font-family="Arial,sans-serif" font-size="46" font-weight="700" fill="#ffffff"><tspan x="80" dy="0">${title.slice(0,46)}</tspan><tspan x="80" dy="60">${title.slice(46)}</tspan></text><text x="80" y="590" font-family="Arial,sans-serif" font-size="20" fill="#b8c7dc">Panduan &amp; Pengetahuan</text></svg>`,'utf8');
}

async function persistImage(buffer,article,config,mimeType='image/jpeg'){
  if(config.storage!=='blob')throw new Error('unsupported_article_image_storage');
  if(!String(process.env.BLOB_READ_WRITE_TOKEN||'').trim())throw new Error('blob_token_missing');
  const slug=clean(article.slug||article.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'artikel';
  const extension=mimeType==='image/svg+xml'?'svg':'jpg';
  const blob=await put(`articles/${slug}-${Date.now()}.${extension}`,buffer,{access:'public',contentType:mimeType,addRandomSuffix:true});
  if(!blob?.url)throw new Error('blob_url_missing');
  return blob.url;
}

export async function generateAndPersistArticleImage(article={}){
  const config=imageConfig();
  if(!config.enabled)return{status:'disabled',imageUrl:null,config};
  const generatedAt=new Date().toISOString();
  let buffer=null,sourceType='ai_generated',model=config.model,mime='image/jpeg';
  if(config.provider==='gemini'){
    try{buffer=await generateGemini(buildArticleImagePrompt(article),config)}catch(error){
      if(config.fallback!=='branded')throw error;
      buffer=fallbackSvg(article,config);sourceType='branded_fallback';model=config.model;mime='image/svg+xml';
    }
  }else if(config.fallback==='branded'){
    buffer=fallbackSvg(article,config);sourceType='branded_fallback';model='none';mime='image/svg+xml';
  }else throw new Error('unsupported_article_image_provider');
  const imageUrl=await persistImage(buffer,article,config,mime);
  return {status:'ready',imageUrl,imageAlt:clean(article.title||'Artikel Berita Auto'),imageCaption:sourceType==='ai_generated'&&config.disclosure?'Ilustrasi AI — Berita Auto':'Ilustrasi Berita Auto',imageSourceType:sourceType,imageModel:model,imageGeneratedAt,site: SITE};
}

export {imageConfig,fallbackSvg};
