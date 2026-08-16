import sharp from 'sharp';

const MIN_BYTES=8*1024;
const MAX_BYTES=8*1024*1024;
const TIMEOUT_MS=4500;

export async function validateSocialCardBuffer(buffer,{expectedTextLength=0}={}){
  if(!Buffer.isBuffer(buffer)||buffer.length<MIN_BYTES||buffer.length>MAX_BYTES)throw new Error('social_card_invalid_size');
  const meta=await sharp(buffer).metadata();
  if(meta.format!=='jpeg'||meta.width!==1080||meta.height!==1350)throw new Error('social_card_invalid_dimensions');
  const stats=await sharp(buffer).stats();
  const means=stats.channels.map(channel=>Number(channel.mean)||0);
  const variances=stats.channels.map(channel=>Number(channel.stdev)||0);
  const mean=means.reduce((a,b)=>a+b,0)/Math.max(1,means.length);
  const variance=variances.reduce((a,b)=>a+b,0)/Math.max(1,variances.length);
  if(mean>252&&variance<2)throw new Error('social_card_blank_white');
  if(mean<3&&variance<2)throw new Error('social_card_blank_dark');
  if(Number(expectedTextLength)>0&&Number(expectedTextLength)<8)throw new Error('social_card_text_missing');
  return {format:meta.format,width:meta.width,height:meta.height,bytes:buffer.length,mean,variance};
}

export async function validateSocialCardUrl(url,{expectedTextLength=0,timeoutMs=TIMEOUT_MS,fetchImpl=fetch}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const started=Date.now();
  try{
    const response=await fetchImpl(url,{method:'GET',headers:{Accept:'image/jpeg'},signal:controller.signal,cache:'no-store',redirect:'follow'});
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    const declaredTextLength=Number(response.headers.get('x-social-card-text-length')||expectedTextLength||0);
    if(!response.ok||type!=='image/jpeg')throw new Error(`social_card_invalid_response_${response.status}_${type||'missing_content_type'}`);
    if(response.headers.get('x-social-card-render')!=='valid')throw new Error('social_card_render_guard_missing');
    const buffer=Buffer.from(await response.arrayBuffer());
    const result=await validateSocialCardBuffer(buffer,{expectedTextLength:declaredTextLength});
    return {...result,durationMs:Date.now()-started};
  }catch(error){
    if(error?.name==='AbortError')throw new Error('social_card_validation_timeout');
    throw error;
  }finally{clearTimeout(timer);}
}
