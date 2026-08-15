import {getJson,setJson,delKey,listJson,upsertIndexed,removeIndexed} from './persistence.js';
export {AD_SLOTS,adSlotList,adSlot,safeTargetUrl,normalizeAdPayload,AD_MAX_UPLOAD_BYTES,AD_ALLOWED_IMAGES,validateImageFileMeta,validateImageBytes,adAspectRatio} from './ads-core.js';

export const ADS_INDEX='ba:ads:index';
const adKey=id=>`ba:ads:${id}`;
const activeKey=slot=>`ba:ads:active:${slot}`;

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

export function isVercelBlobUrl(value){try{return new URL(String(value)).hostname.endsWith('.blob.vercel-storage.com')}catch{return false}}
