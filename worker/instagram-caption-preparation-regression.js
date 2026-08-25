// Regression coverage for the canonical rich-v3 preparation wiring and bounded caption repair.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildInstagramCaptionAsync,CAPTION_GENERATOR_VERSION,validateInstagramCaption} from '../lib/instagram-caption.js';

const preparation=fs.readFileSync(new URL('../lib/social-preparation.js',import.meta.url),'utf8');
const publisher=fs.readFileSync(new URL('./social-run.js',import.meta.url),'utf8');

assert.equal(CAPTION_GENERATOR_VERSION,'rich-v3');
assert.match(preparation,/buildInstagramCaptionAsync\(article,siteUrl\)/,'normal preparation must invoke rich-v3');
assert.match(preparation,/CAPTION_VALIDATION/,'preparation must expose caption validation stage');
assert.match(preparation,/CAPTION_REPAIR/,'preparation must expose bounded caption repair stage');
assert.match(preparation,/CAPTION_FALLBACK/,'preparation must expose safe fallback stage');
assert.match(preparation,/captionStatus:cardReady\?'READY':'INVALID'/,'caption READY must follow card readiness');
assert.match(preparation,/captionReady:cardReady&&Boolean\(captionMeta\.caption\)/,'READY must have persisted caption metadata');
assert.match(preparation,/captionEdited===true/,'manual caption protection must remain');
assert.match(preparation,/captionGeneratorVersion===CAPTION_GENERATOR_VERSION/,'rich-v3 reuse must be source-hash guarded');
assert.match(preparation,/CAPTION_AI_TIMEOUT|CAPTION_AI_FAILED/,'caption generation must have a bounded AI timeout');
assert.doesNotMatch(publisher,/deterministicCaption\(/,'publisher must not generate a caption');
assert.match(publisher,/processing\.captionStatus!=='READY'/,'publisher must require prepared caption');

const source=Array.from({length:22},(_,i)=>`Pada perkembangan ke-${i+1}, Pemerintah dan Kementerian terkait mencatat angka ${100+i} persen pada 2026 di Jakarta. Fakta ini menjelaskan kronologi, keputusan, respons, dan dampak yang dilaporkan dalam artikel.`).join(' ');
const article={id:'rich-v3-regression',stableId:'rich-v3-regression',title:'Pemerintah catat perkembangan program di Jakarta',category:'Nasional',sitePublishedAt:'2026-08-25T00:00:00.000Z',sourceUrl:'https://example.com/source',canonicalUrl:'https://berita-auto.vercel.app/berita/rich-v3-regression',content:source,slug:'rich-v3-regression'};
const result=await buildInstagramCaptionAsync(article,'https://berita-auto.vercel.app');
assert.equal(result.captionGeneratorVersion,'rich-v3');
assert.equal(result.articleUrl,'https://berita-auto.vercel.app/berita/rich-v3-regression');
assert.ok(result.caption.endsWith(result.articleUrl),'article URL must be the last line');
assert.ok(result.caption.includes('#BeritaAuto'),'brand hashtag required');
assert.ok(result.caption.length<=2100,'caption hard limit');
assert.ok(result.caption.length>0,'caption must be generated');
assert.ok(validateInstagramCaption(result.caption,article).hardValid,'generated caption must pass hard validation');

const medium={...article,id:'rich-v3-medium',stableId:'rich-v3-medium',slug:'rich-v3-medium',canonicalUrl:'https://berita-auto.vercel.app/berita/rich-v3-medium',content:'Pemerintah menyampaikan perkembangan terbaru di Jakarta. Pernyataan itu diberikan setelah evaluasi sejumlah program yang sedang berjalan. Pemerintah menyebut langkah berikutnya akan disesuaikan dengan hasil evaluasi dan kondisi di lapangan.'};
const mediumResult=await buildInstagramCaptionAsync(medium,'https://berita-auto.vercel.app');
const mediumValidation=validateInstagramCaption(mediumResult.caption,medium);
assert.ok(mediumValidation.hardValid,'medium source must remain hard-valid');
assert.equal(mediumResult.captionQualityTarget.status,'SOURCE_LIMITED');

const short={...article,id:'rich-v3-short',stableId:'rich-v3-short',slug:'rich-v3-short',canonicalUrl:'https://berita-auto.vercel.app/berita/rich-v3-short',content:'Pemerintah menyampaikan perkembangan terbaru di Jakarta dalam keterangan singkat hari ini.'};
const shortResult=await buildInstagramCaptionAsync(short,'https://berita-auto.vercel.app');
assert.equal(shortResult.captionQualityTarget.status,'SOURCE_LIMITED');
assert.ok(validateInstagramCaption(shortResult.caption,short).hardValid,'short source fallback must remain hard-valid');

console.log(JSON.stringify({status:'PASS',generator:result.captionGeneratorVersion,generatedBy:result.captionGeneratedBy,aiUsed:result.captionAiUsed,fallbackUsed:result.captionFallbackUsed,sourceChars:result.captionSourceLength,captionChars:result.captionLength,urlLastLine:result.caption.endsWith(result.articleUrl),coverage:result.captionCoverage?.score||0,mediumHardValid:mediumValidation.hardValid,shortSourceStatus:shortResult.captionQualityTarget.status}));