import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildInstagramCaptionAsync,CAPTION_GENERATOR_VERSION} from '../lib/instagram-caption.js';

const preparation=fs.readFileSync(new URL('../lib/social-preparation.js',import.meta.url),'utf8');
const publisher=fs.readFileSync(new URL('./social-run.js',import.meta.url),'utf8');

assert.equal(CAPTION_GENERATOR_VERSION,'rich-v3');
assert.match(preparation,/await buildInstagramCaptionAsync\(article,siteUrl\)/,'normal preparation must await rich-v3');
assert.match(preparation,/captionStatus:cardReady\?'READY':'INVALID'/,'caption READY must follow card readiness');
assert.match(preparation,/captionReady:cardReady&&Boolean\(captionMeta\.caption\)/,'READY must have persisted caption metadata');
assert.match(preparation,/captionEdited===true/,'manual caption protection must remain');
assert.match(preparation,/captionGeneratorVersion===CAPTION_GENERATOR_VERSION/,'rich-v3 reuse must be source-hash guarded');
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
console.log(JSON.stringify({status:'PASS',generator:result.captionGeneratorVersion,generatedBy:result.captionGeneratedBy,aiUsed:result.captionAiUsed,fallbackUsed:result.captionFallbackUsed,sourceChars:result.captionSourceLength,captionChars:result.captionLength,articleUrl:result.articleUrl,urlLastLine:result.caption.endsWith(result.articleUrl),coverage:result.captionCoverage?.score||0}));
