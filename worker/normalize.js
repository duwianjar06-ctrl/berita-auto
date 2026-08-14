import {fingerprint} from '../lib/hash.js';

export function normalizeUrl(value=''){
  try{const u=new URL(value.trim());u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|fbclid|gclid$/i.test(key))u.searchParams.delete(key);return u.toString().replace(/\/$/,'').toLowerCase();}catch{return value.trim().toLowerCase();}
}
export function normalizeTitle(value=''){return String(value).toLowerCase().normalize('NFKC').replace(/&amp;/g,'&').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();}
export function titleFingerprint(value=''){return fingerprint(normalizeTitle(value));}
export function articleFingerprint(item){return fingerprint(normalizeUrl(item.url)||normalizeTitle(item.title));}
export function buildDedupeKeys(item){return {fingerprint:articleFingerprint(item),titleFingerprint:titleFingerprint(item.title)}}
