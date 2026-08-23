import {getJson,setJson} from './persistence.js';
const KEY='ba:social:instagram:prepare:progress';
const MAX_RESULTS=20;
const safe=v=>String(v??'').slice(0,500);
export async function getInstagramPreparationProgress(){return getJson(KEY);}
export async function setInstagramPreparationProgress(patch={}){const current=(await getJson(KEY))||{};const next={...current,...patch,updatedAt:new Date().toISOString()};if(Array.isArray(next.candidateResults))next.candidateResults=next.candidateResults.slice(-MAX_RESULTS);await setJson(KEY,next);return next;}
export async function upsertInstagramPreparationCandidate(result){const current=(await getJson(KEY))||{};const rows=Array.isArray(current.candidateResults)?[...current.candidateResults]:[];const idx=rows.findIndex(x=>String(x?.index)===String(result?.index));if(idx>=0)rows[idx]={...rows[idx],...result};else rows.push(result);return setInstagramPreparationProgress({...current,candidateResults:rows.slice(-MAX_RESULTS)});}
export function normalizeStorageError(error){const raw=safe(error?.message||error||'storage_error');const low=raw.toLowerCase();if(low.includes('this_store_has_been_suspended')||low.includes('store_has_been_suspended'))return{code:'VERCEL_BLOB_STORE_SUSPENDED',safeMessage:'Vercel Blob store sedang suspended.'};if(low.includes('token')||low.includes('authorization'))return{code:'STORAGE_AUTH_ERROR',safeMessage:'Penyimpanan Social Card tidak dapat diautentikasi.'};return{code:'CARD_PERSIST_FAILED',safeMessage:raw};}
export async function finishInstagramPreparationProgress(status,extra={}){const current=(await getJson(KEY))||{};return setInstagramPreparationProgress({...current,status,active:false,completedAt:new Date().toISOString(),...extra});}
export {KEY as INSTAGRAM_PREPARATION_PROGRESS_KEY,MAX_RESULTS};
