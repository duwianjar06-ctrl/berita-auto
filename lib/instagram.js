const DEFAULT_VERSION='v26.0';
const DEFAULT_TIMEOUT_MS=15000;

export function instagramConfig(){
  return {
    enabled:String(process.env.INSTAGRAM_ENABLED||'').toLowerCase()==='true',
    userId:String(process.env.INSTAGRAM_USER_ID||''),
    accessToken:String(process.env.INSTAGRAM_ACCESS_TOKEN||''),
    apiVersion:String(process.env.INSTAGRAM_API_VERSION||DEFAULT_VERSION).replace(/^v?/,'v'),
    siteUrl:String(process.env.SITE_URL||'https://berita-auto.vercel.app').replace(/\/$/,'')
  };
}

export function instagramConfigured(){
  const c=instagramConfig();
  return c.enabled&&Boolean(c.userId&&c.accessToken&&c.apiVersion&&c.siteUrl);
}

function safeMessage(body,status){
  const message=body?.error?.message||body?.error?.error_user_msg||body?.message||`http_${status}`;
  return String(message).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,300);
}

export function classifyInstagramError(error){
  const code=Number(error?.metaCode||error?.code||0);
  const status=Number(error?.status||0);
  const message=String(error?.message||error||'').toLowerCase();
  if(code===190||/invalid.*token|expired.*token|oauth.*exception/.test(message))return{kind:'permanent',reason:'auth_token_invalid',metaCode:code||190};
  if(/permission|not authorized|access denied/.test(message))return{kind:'permanent',reason:'permission_denied',metaCode:code||null};
  if(/invalid.*image|image.*invalid|unsupported.*image|invalid.*url/.test(message))return{kind:'permanent',reason:'invalid_media',metaCode:code||null};
  if(status===429||code===4||code===17||/rate.?limit|too many requests/.test(message))return{kind:'transient',reason:'rate_limited',metaCode:code||null};
  if(status>=500||/timeout|timed out|fetch failed|network|temporarily unavailable/.test(message))return{kind:'transient',reason:'upstream_unavailable',metaCode:code||null};
  return{kind:'transient',reason:'instagram_request_failed',metaCode:code||null};
}

async function request(path,{method='GET',body,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  const c=instagramConfig();
  if(!c.userId||!c.accessToken)throw Object.assign(new Error('instagram_credentials_missing'),{status:500});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(`https://graph.instagram.com/${c.apiVersion}/${path.replace(/^\//,'')}`,{
      method,
      headers:{Authorization:`Bearer ${c.accessToken}`,'Content-Type':'application/json',Accept:'application/json'},
      body:body?JSON.stringify(body):undefined,
      signal:controller.signal,
      cache:'no-store'
    });
    let payload=null;
    try{payload=await response.json();}catch{}
    if(!response.ok||payload?.error){
      const error=Object.assign(new Error(safeMessage(payload,response.status)),{status:response.status,metaCode:Number(payload?.error?.code||0)||null,metaType:payload?.error?.type||null});
      throw error;
    }
    return payload;
  }catch(error){
    if(error?.name==='AbortError')throw Object.assign(new Error('instagram_request_timeout'),{status:408});
    throw error;
  }finally{clearTimeout(timer);}
}

export async function createMediaContainer({imageUrl,caption}){
  const c=instagramConfig();
  const payload=await request(`${c.userId}/media`,{method:'POST',body:{image_url:imageUrl,caption}});
  if(!payload?.id)throw Object.assign(new Error('instagram_container_id_missing'),{status:502});
  console.log(`[instagram] container_created containerId=${String(payload.id).slice(0,120)}`);
  return String(payload.id);
}

export async function getMediaContainerStatus(containerId){
  return request(`${String(containerId)}?fields=status_code,status`,{method:'GET'});
}

export async function publishMediaContainer(containerId){
  const c=instagramConfig();
  const payload=await request(`${c.userId}/media_publish`,{method:'POST',body:{creation_id:String(containerId)}});
  if(!payload?.id)throw Object.assign(new Error('instagram_media_id_missing'),{status:502});
  return String(payload.id);
}

export async function getPublishingUsage(){
  const c=instagramConfig();
  try{
    const payload=await request(`${c.userId}/content_publishing_limit?fields=config,quota_usage`,{method:'GET',timeoutMs:10000});
    const usage=Number(payload?.quota_usage);
    const total=Number(payload?.config?.quota_total||payload?.config?.quota_total_count);
    if(Number.isFinite(usage)&&Number.isFinite(total))return{available:true,usage,total,remaining:Math.max(0,total-usage),raw:payload};
    return{available:false,reason:'meta_limit_shape_unavailable'};
  }catch(error){
    return{available:false,reason:classifyInstagramError(error).reason};
  }
}

export async function pollContainerReady(containerId,{maxAttempts=6,delayMs=2500,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const status=await getMediaContainerStatus(containerId);
    const code=String(status?.status_code||status?.status||'').toUpperCase();
    if(code==='FINISHED'||code==='READY'||code==='PUBLISHED')return{ready:true,status};
    if(code==='ERROR'||code==='EXPIRED')return{ready:false,permanent:true,status};
    if(attempt<maxAttempts)await sleep(delayMs*attempt);
  }
  return{ready:false,permanent:false,reason:'media_processing_timeout'};
}
