import {fingerprint} from '../lib/hash.js';
export function normalizeUrl(value=''){try{const u=new URL(value.trim());u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|fbclid|gclid$/i.test(key))u.searchParams.delete(key);return u.toString().replace(/\/$/,'').toLowerCase()}catch{return value.trim().toLowerCase()}}
export function articleFingerprint(item){return fingerprint(normalizeUrl(item.url)||item.title)}
