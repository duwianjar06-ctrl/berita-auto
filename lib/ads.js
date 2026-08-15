import {randomUUID} from 'node:crypto';
import {getJson,setJson,delKey,listJson,upsertIndexed,removeIndexed} from './persistence.js';

export const ADS_INDEX='ba:ads:index';
const adKey=id=>`ba:ads:${id}`;
const activeKey=slot=>`ba:ads:active:${slot}`;

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
  return {
    id:existing?.id||String(raw.id||randomUUID()),
    title,
    slot,
    imageUrl,
    targetUrl,
    altText,
    isActive:Boolean(raw.isActive??existing?.isActive??true),
    createdAt:existing?.createdAt||now,
    updatedAt:now
  };
}

export async function listAds(){return listJson(ADS_INDEX)}
export async function getAd(id){return getJson(adKey(id))}
export async function getActiveAd(slot){
  if(!AD_SLOTS[slot])return null;
  const activeId=await getJson(activeKey(slot));
  if(typeof activeId!=='string'||!activeId)return null;
  const ad=await getJson(adKey(activeId));
  if(!ad?.isActive||ad.slot!==slot)return null;
  return ad;
}

export async function persistAd(ad){
  const existing=await listAds();
  if(ad.isActive){
    for(const row of existing){
      if(row.id!==ad.id&&row.slot===ad.slot&&row.isActive){
        const inactive={...row,isActive:false,updatedAt:ad.updatedAt};
        await upsertIndexed(ADS_INDEX,adKey(inactive.id),inactive);
      }
    }
    await setJson(activeKey(ad.slot),ad.id);
  }else{
    const current=await getJson(activeKey(ad.slot));
    if(current===ad.id)await delKey(activeKey(ad.slot));
  }
  await upsertIndexed(ADS_INDEX,adKey(ad.id),ad);
  return ad;
}

export async function removeAd(id){
  const ad=await getAd(id);
  if(!ad)return null;
  const current=await getJson(activeKey(ad.slot));
  if(current===id)await delKey(activeKey(ad.slot));
  await removeIndexed(ADS_INDEX,adKey(id));
  return ad;
}

export function isVercelBlobUrl(value){
  try{return new URL(String(value)).hostname.endsWith('.blob.vercel-storage.com')}catch{return false}
}

export const AD_MAX_UPLOAD_BYTES=2*1024*1024;
export const AD_ALLOWED_IMAGES=Object.freeze({
  'image/jpeg':['.jpg','.jpeg'],
  'image/png':['.png'],
  'image/webp':['.webp']
});

export function validateImageFileMeta(file){
  const type=String(file?.type||'').toLowerCase();
  const name=String(file?.name||'').toLowerCase();
  if(!AD_ALLOWED_IMAGES[type])throw new Error('Format gambar harus JPG, JPEG, PNG, atau WebP');
  if(!AD_ALLOWED_IMAGES[type].some(ext=>name.endsWith(ext)))throw new Error('Ekstensi file tidak sesuai MIME type');
  if(!Number.isFinite(file?.size)||file.size<=0||file.size>AD_MAX_UPLOAD_BYTES)throw new Error('Ukuran gambar maksimal 2 MB');
}

export function validateImageBytes(buffer,type){
  const b=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
  if(type==='image/jpeg')return b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(type==='image/png')return b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(type==='image/webp')return b.length>=12&&b.subarray(0,4).toString('ascii')==='RIFF'&&b.subarray(8,12).toString('ascii')==='WEBP';
  return false;
}

export function adAspectRatio(slot){
  const variant=AD_SLOTS[slot]?.variant;
  return variant==='rectangle'?'4 / 3':variant==='inArticle'?'5 / 1':variant==='footer'?'6 / 1':'16 / 3';
}
