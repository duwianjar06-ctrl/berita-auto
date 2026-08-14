const baseUrl=process.env.UPSTASH_REDIS_REST_URL||'';
const token=process.env.UPSTASH_REDIS_REST_TOKEN||'';

export function persistenceConfigured(){return Boolean(baseUrl&&token)}

async function command(args){
  if(!persistenceConfigured()) return null;
  const response=await fetch(baseUrl,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'});
  if(!response.ok) throw new Error(`persistence_http_${response.status}`);
  const body=await response.json();
  if(body?.error) throw new Error(String(body.error));
  return body?.result??null;
}

export async function getJson(key){const raw=await command(['GET',key]);if(!raw)return null;try{return JSON.parse(raw)}catch{return null}}
export async function setJson(key,value){await command(['SET',key,JSON.stringify(value)]);return value}
export async function delKey(key){await command(['DEL',key])}
export async function setAdd(index,id){await command(['SADD',index,id])}
export async function setRemove(index,id){await command(['SREM',index,id])}
export async function setMembers(index){return (await command(['SMEMBERS',index]))||[]}
export async function sortedAdd(index,score,id){await command(['ZADD',index,score,id])}
export async function sortedRange(index,start=0,stop=19){return (await command(['ZREVRANGE',index,start,stop]))||[]}
export async function sortedRemove(index,id){await command(['ZREM',index,id])}
export async function listJson(index){const ids=await setMembers(index);const rows=await Promise.all(ids.map(id=>getJson(id)));return rows.filter(Boolean).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))}
export async function upsertIndexed(index,itemKey,item){await setJson(itemKey,item);await setAdd(index,itemKey);return item}
export async function removeIndexed(index,itemKey){await setRemove(index,itemKey);await delKey(itemKey)}
