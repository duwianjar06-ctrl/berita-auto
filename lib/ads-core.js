const newId=()=>typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;

export const AD_SLOTS=Object.freeze({
  homepage_top:{label:'Homepage — Top',variant:'leaderboard'},
  homepage_sidebar:{label:'Homepage — Sidebar',variant:'rectangle'},
  homepage_after_featured:{label:'Homepage — Setelah Featured',variant:'leaderboard'},
  homepage_feed_1:{label:'Homepage — Feed 1',variant:'leaderboard'},
  homepage_category_1:{label:'Homepage — Kategori 1',variant:'leaderboard'},
  homepage_bottom:{label:'Homepage — Bawah',variant:'footer'},
  article:{label:'Artikel — Tengah',variant:'inArticle'},
  sidebar:{label:'Artikel — Sidebar',variant:'rectangle'}
});

export const adSlotList=Object.entries(AD_SLOTS).map(([slot,config])=>({slot,...config}));
export const adSlot=(slot)=>AD_SLOTS[slot]||null;

export function safeTargetUrl(value){
  const raw=String(value??'').trim();
  if(!raw||raw.length>2048)throw new Error('Target URL wajib diisi dan maksimal 2048 karakter');
  if(raw.startsWith('/')&&!raw.startsWith('//'))return raw;
  let parsed;
  try{parsed=new URL(raw)}catch{throw new Error('Target URL tidak valid')}
  if(!['http:','https:'].includes(parsed.protocol))throw new Error('Target URL hanya boleh menggunakan http atau https');
  return parsed.toString();
}

export function normalizeAdPayload(raw={},existing=null){
  const slot=String(raw.slot??existing?.slot??'').trim();
  if(!AD_SLOTS[slot])throw new Error('Slot iklan tidak valid');
  const imageUrl=String(raw.imageUrl??existing?.imageUrl??'').trim();
  if(!imageUrl||imageUrl.length>4096)throw new Error('Gambar iklan wajib diisi');
  const targetUrl=safeTargetUrl(raw.targetUrl??existing?.targetUrl);
  const title=String(raw.title??existing?.title??'').trim().slice(0,160)||'Iklan Berita Auto';
  const altText=String(raw.altText??existing?.altText??title).trim().slice(0,180)||title;
  const now=new Date().toISOString();
  return {id:existing?.id||String(raw.id||newId()),title,slot,imageUrl,targetUrl,altText,isActive:Boolean(raw.isActive??existing?.isActive??true),createdAt:existing?.createdAt||now,updatedAt:now};
}

export const AD_MAX_UPLOAD_BYTES=2*1024*1024;
export const AD_ALLOWED_IMAGES=Object.freeze({'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/webp':['.webp']});

export function validateImageFileMeta(file){
  const type=String(file?.type||'').toLowerCase();
  const name=String(file?.name||'').toLowerCase();
  if(!AD_ALLOWED_IMAGES[type])throw new Error('Format gambar harus JPG, JPEG, PNG, atau WebP');
  if(!AD_ALLOWED_IMAGES[type].some(ext=>name.endsWith(ext)))throw new Error('Ekstensi file tidak sesuai MIME type');
  if(!Number.isFinite(file?.size)||file.size<=0||file.size>AD_MAX_UPLOAD_BYTES)throw new Error('Ukuran gambar maksimal 2 MB');
}

function bytesEqual(bytes,signature){return bytes.length>=signature.length&&signature.every((value,index)=>bytes[index]===value)}
export function validateImageBytes(input,type){
  const b=input instanceof Uint8Array?input:new Uint8Array(input);
  if(type==='image/jpeg')return b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(type==='image/png')return bytesEqual(b,[137,80,78,71,13,10,26,10]);
  if(type==='image/webp')return b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
  return false;
}

export function adAspectRatio(slot){const variant=AD_SLOTS[slot]?.variant;return variant==='rectangle'?'4 / 3':variant==='inArticle'?'5 / 1':variant==='footer'?'6 / 1':'16 / 3'}
