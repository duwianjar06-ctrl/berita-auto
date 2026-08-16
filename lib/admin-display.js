const PROVIDER_LABELS={gemini_primary:'Gemini Primary',gemini_secondary:'Gemini Secondary',groq:'Groq',fallback:'Fallback'};

export function humanizeProvider(value){const key=String(value||'').trim();if(!key)return '—';return PROVIDER_LABELS[key]||key.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}

export function formatProviderUsage(value){
  if(value===null||value===undefined||value==='')return '—';
  if(typeof value==='string')return humanizeProvider(value);
  if(typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value))return value.map(v=>formatProviderUsage(v)).filter(Boolean).join(', ')||'—';
  if(typeof value==='object'){
    const entries=Object.entries(value).filter(([key,count])=>key&&count!==null&&count!==undefined&&count!=='');
    if(!entries.length)return '—';
    return entries.map(([key,count])=>`${humanizeProvider(key)}${typeof count==='number'||typeof count==='string'?' ('+count+')':''}`).join(', ');
  }
  return '—';
}

export function toDisplayText(value,fallback='—'){
  if(value===null||value===undefined||value==='')return fallback;
  if(typeof value==='string')return value;
  if(typeof value==='number')return String(value);
  if(typeof value==='boolean')return value?'Ya':'Tidak';
  if(Array.isArray(value))return value.map(item=>toDisplayText(item,'')).filter(Boolean).join(', ')||fallback;
  return fallback;
}

export function normalizeWarnings(value){
  if(!Array.isArray(value))return [];
  return value.map(item=>typeof item==='string'?item:(item&&typeof item==='object'&&typeof item.code==='string'?item.code:null)).filter(Boolean);
}
