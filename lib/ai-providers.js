const DEFAULT_GEMINI_MODEL='gemini-2.5-flash';
const DEFAULT_OPENAI_MODEL='gpt-4o-mini';
const AI_TIMEOUT_MS=18000;
const MAX_RETRIES=1;
let geminiCatalogPromise=null;
function retryable(error){const message=String(error?.message||error||'');return error?.name==='AbortError'||message==='gemini_http_429'||message==='openai_http_429'||/(?:^|_http_)5\d\d$/.test(message)||/timeout|server_error/i.test(message);}
async function withRetry(fn){let lastError;for(let attempt=0;attempt<=MAX_RETRIES;attempt++){try{return await fn(attempt+1);}catch(error){lastError=error;if(attempt>=MAX_RETRIES||!retryable(error))throw error;await new Promise(resolve=>setTimeout(resolve,250));}}throw lastError;}
async function listGeminiModels(requestWithTimeout){
  if(geminiCatalogPromise)return geminiCatalogPromise;
  geminiCatalogPromise=(async()=>{try{
    const res=await requestWithTimeout('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{method:'GET',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY}});
    if(!res.ok)return{status:`gemini_catalog_http_${res.status}`,models:[]};
    const data=await res.json();
    return{status:'success',models:(data.models||[]).filter(model=>(model.supportedGenerationMethods||[]).includes('generateContent'))};
  }catch(error){return{status:error?.name==='AbortError'?'timeout':'error',models:[]};}})();
  return geminiCatalogPromise;
}
function preferredAvailableModel(models,current){const ids=new Set(models.map(model=>String(model.name||'').replace(/^models\//,'')).filter(Boolean));if(ids.has(current))return current;for(const candidate of ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-3.5-flash-lite','gemini-3-flash-preview'])if(ids.has(candidate))return candidate;return null;}
export function getProviderRegistry({buildPrompt,parseJsonText,validateOutput,requestWithTimeout}){
 const gemini={name:'gemini',modelName:process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL,isConfigured:()=>Boolean(process.env.GEMINI_API_KEY),timeoutMs:AI_TIMEOUT_MS,generate:async(item,material)=>withRetry(async()=>{
   let model=gemini.modelName;
   const endpoint=name=>`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(name)}:generateContent`;
   const payload=()=>({contents:[{role:'user',parts:[{text:buildPrompt(item,material)}]}],generationConfig:{temperature:0.15,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{title:{type:'STRING'},excerpt:{type:'STRING'},content:{type:'STRING'},language:{type:'STRING'}},required:['title','excerpt','content','language']}}});
   const headers={'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY};
   let res=await requestWithTimeout(endpoint(model),{method:'POST',headers,body:JSON.stringify(payload())});
   if(res.status===404){const catalog=await listGeminiModels(requestWithTimeout);const available=preferredAvailableModel(catalog.models,model);console.warn(`[ai] provider=gemini diagnostic=catalog status=${catalog.status} requestedModel=${model} availableMatch=${Boolean(available)}`);if(available&&available!==model){model=available;res=await requestWithTimeout(endpoint(model),{method:'POST',headers,body:JSON.stringify(payload())});}}
   if(!res.ok)throw new Error(`gemini_http_${res.status}`);
   const data=await res.json();const text=data.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('')||'';const parsed=parseJsonText(text);if(!parsed)throw new Error('gemini_invalid_response');
   return{...validateOutput(parsed,material,item),generationProvider:'gemini',generationModel:model,generationAt:new Date().toISOString()};
 })};
 const openai={name:'openai',modelName:process.env.OPENAI_MODEL||DEFAULT_OPENAI_MODEL,isConfigured:()=>Boolean(process.env.OPENAI_API_KEY),timeoutMs:AI_TIMEOUT_MS,generate:async(item,material)=>withRetry(async()=>{const model=openai.modelName;const payload={model,messages:[{role:'user',content:buildPrompt(item,material)}],temperature:0.15,response_format:{type:'json_object'}};const res=await requestWithTimeout('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify(payload)});if(!res.ok)throw new Error(`openai_http_${res.status}`);const data=await res.json();const parsed=parseJsonText(data.choices?.[0]?.message?.content||'');if(!parsed)throw new Error('openai_invalid_response');return{...validateOutput(parsed,material,item),generationProvider:'openai',generationModel:model,generationAt:new Date().toISOString()};})};
 return[gemini,openai];
}
export{DEFAULT_GEMINI_MODEL,DEFAULT_OPENAI_MODEL,AI_TIMEOUT_MS};
