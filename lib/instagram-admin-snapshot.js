import {getJson} from './persistence.js';
import {getAdminInstagramStatus} from './admin-instagram.js';

const ACTIVE_KEY='ba:social:instagram:prepare:active';
const TTL_MS=Math.max(10000,Math.min(20000,Number(process.env.INSTAGRAM_ADMIN_SNAPSHOT_TTL_MS||15000)));
let cacheValue=null;
let cacheExpiresAt=0;
let inFlight=null;

function activeValue(value){return value&&Number(value.expiresAt||0)>Date.now()?value:null}

export async function getInstagramAdminSnapshot({forceRefresh=false}={}){
  const now=Date.now();
  if(!forceRefresh&&cacheValue&&cacheExpiresAt>now)return cacheValue;
  if(!forceRefresh&&inFlight)return inFlight;
  inFlight=(async()=>{
    const [status,active]=await Promise.all([getAdminInstagramStatus(),getJson(ACTIVE_KEY)]);
    const value={...status,preparation:{active:activeValue(active),lastRun:status?.review?.lastPreparation||status?.latestRun||null}};
    cacheValue=value;cacheExpiresAt=Date.now()+TTL_MS;return value;
  })();
  try{return await inFlight}finally{inFlight=null}
}

export function invalidateInstagramAdminSnapshot(){cacheValue=null;cacheExpiresAt=0}
export const instagramAdminSnapshotTtlMs=TTL_MS;
