// Regression contract: preparation must be bounded, resumable, and never permanently PREPARING.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildInstagramSlides} from '../lib/social-visual.js';
import {INSTAGRAM_CAROUSEL_MAX_ITEMS} from '../lib/social-carousel.js';
import {INSTAGRAM_CAROUSEL_MAX_SLIDES} from '../lib/instagram-carousel-contract.js';
import {PREPARATION_STALE_THRESHOLD_MS,preparationHeartbeatFresh} from '../lib/instagram-preparation-progress.js';

const prep=fs.readFileSync(new URL('../lib/social-preparation.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../lib/instagram-preparation-admin-live.js',import.meta.url),'utf8');
const route=fs.readFileSync(new URL('../app/api/admin/instagram/prepare-now/route.js',import.meta.url),'utf8');
const publisher=fs.readFileSync(new URL('./social-run.js',import.meta.url),'utf8');

assert.equal(INSTAGRAM_CAROUSEL_MAX_SLIDES,2);
assert.equal(INSTAGRAM_CAROUSEL_MAX_ITEMS,2);
const short={id:'short',title:'Berita singkat',category:'Nasional',content:'Pemerintah mengumumkan kebijakan baru hari ini.',sitePublishedAt:'2026-08-25T00:00:00Z',sourceUrl:'https://example.com/a'};
const long={...short,id:'long',content:Array.from({length:10},(_,i)=>`Paragraf panjang ke-${i+1} menjelaskan kronologi, keputusan, respons, lokasi, waktu, dan dampak kebijakan pemerintah secara rinci.`).join('\n\n')};
for(const article of [short,long]){const slides=buildInstagramSlides(article);assert.ok(slides.length>=1&&slides.length<=2)}
assert.match(prep,/INSTAGRAM_CAROUSEL_MAX_SLIDES/);
assert.doesNotMatch(prep,/sourceUrls\.length>3/);
assert.match(admin,/PREPARATION_CANDIDATE_TIMEOUT/);
assert.match(admin,/stageDurationsMs/);
assert.match(admin,/byId\.get\(String\(item\?\.article\?\.id\)\)\|\|item\.article/);
assert.doesNotMatch(admin,/deterministicCaption\(/);
assert.match(route,/recoverStale:true/);
assert.doesNotMatch(route,/getInstagramAdminSnapshot\(/);
assert.match(publisher,/INSTAGRAM_CAROUSEL_MAX_ITEMS/);
const now=Date.now();
assert.equal(preparationHeartbeatFresh({status:'PREPARING',heartbeatAt:new Date(now-1000).toISOString(),expiresAt:now+60000},now),true);
assert.equal(preparationHeartbeatFresh({status:'PREPARING',heartbeatAt:new Date(now-PREPARATION_STALE_THRESHOLD_MS-1000).toISOString(),expiresAt:now+60000},now),false);
console.log('instagram preparation resilience: PASS');
