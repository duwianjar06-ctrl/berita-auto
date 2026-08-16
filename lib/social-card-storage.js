import {validateSocialCardBuffer} from './social-card-validation.js';

const MAX_BYTES=8*1024*1024;

function safeSegment(value,fallback='card'){
  const normalized=String(value||'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  return normalized||fallback;
}

export async function persistSocialCardUrl(sourceUrl,{articleId,runId,slide=1}={}){
  const token=process.env.BLOB_READ_WRITE_TOKEN||'';
  if(!token)throw Object.assign(new Error('card_persist_storage_not_configured'),{permanent:true,failureStage:'CARD_PERSIST'});
  const {put}=await import('@vercel/blob');
  if(!/^https:\/\//i.test(String(sourceUrl||'')))throw Object.assign(new Error('card_persist_invalid_source_url'),{permanent:true,failureStage:'CARD_PERSIST'});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  const started=Date.now();
  try{
    const response=await fetch(sourceUrl,{method:'GET',headers:{Accept:'image/jpeg'},signal:controller.signal,cache:'no-store',redirect:'follow'});
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(!response.ok||type!=='image/jpeg')throw Object.assign(new Error(`card_persist_source_invalid_${response.status}_${type||'missing_content_type'}`),{failureStage:'CARD_PERSIST'});
    const buffer=Buffer.from(await response.arrayBuffer());
    if(!buffer.length||buffer.length>MAX_BYTES)throw Object.assign(new Error('card_persist_source_invalid_size'),{failureStage:'CARD_PERSIST'});
    const validation=await validateSocialCardBuffer(buffer,{expectedTextLength:Number(response.headers.get('x-social-card-text-length')||0)});
    const pathname=`social/instagram/${safeSegment(articleId,'article')}/${safeSegment(runId,'run')}-${Math.max(1,Number(slide)||1)}.jpg`;
    const blob=await put(pathname,buffer,{access:'public',contentType:'image/jpeg',addRandomSuffix:true,token});
    return{url:blob.url,pathname:blob.pathname,bytes:validation.bytes,width:validation.width,height:validation.height,format:validation.format,durationMs:Date.now()-started,sourceUrl};
  }catch(error){
    if(error?.name==='AbortError')throw Object.assign(new Error('card_persist_timeout'),{retryable:true,failureStage:'CARD_PERSIST'});
    if(error?.retryable!==undefined)throw error;
    throw Object.assign(error instanceof Error?error:new Error(String(error)),{failureStage:error?.failureStage||'CARD_PERSIST'});
  }finally{clearTimeout(timer);}
}

export async function persistSocialCards(sourceUrls,{articleId,runId}={}){
  const urls=Array.isArray(sourceUrls)?sourceUrls.filter(Boolean):[];
  if(!urls.length)throw Object.assign(new Error('card_persist_no_source_urls'),{permanent:true,failureStage:'CARD_PERSIST'});
  const cards=[];
  for(let index=0;index<urls.length;index++)cards.push(await persistSocialCardUrl(urls[index],{articleId,runId,slide:index+1}));
  return cards;
}
