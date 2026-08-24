import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildInstagramCaption,validateInstagramCaption} from '../lib/instagram-caption.js';
import {buildInstagramSeo} from '../lib/social.js';

const longSentence=(i)=>`Pada Senin ${10+(i%18)} Agustus 2026, Arsenal dan Manchester City menjadi perhatian setelah pertandingan berlangsung di London dengan hasil ${2+i%3}-${1+i%2}. Menurut laporan artikel, keputusan tersebut berdampak pada persiapan kedua tim dan angka ${100+i} tercatat dalam data pertandingan.`;
const longArticle=Array.from({length:55},(_,i)=>longSentence(i)).join(' ');
const article={id:'caption-regression-1',slug:'caption-regression-1',title:'Arsenal dan Manchester City menjadi perhatian setelah pertandingan',category:'Olahraga',publisher:'Reuters',content:longArticle,excerpt:'Ringkasan singkat yang tidak boleh menjadi sumber utama ketika content tersedia.'};
const rich=buildInstagramCaption(article);
assert.equal(rich.captionSourceLength,longArticle.length);
assert.equal(rich.captionGeneratedBy,'deterministic-rich');
assert.equal(rich.oneAiCallMax,0);
assert.ok(rich.captionLength>=900,`expected >=900, got ${rich.captionLength}`);
assert.ok(rich.captionLength<=2100,`expected <=2100, got ${rich.captionLength}`);
assert.equal(rich.captionLengthStatus,'GOOD');
assert.ok(rich.caption.includes('Arsenal'));
assert.ok(rich.caption.includes('London'));
assert.ok(rich.caption.includes('#BeritaAuto'));
assert.ok((rich.caption.match(/#[\p{L}\p{N}_-]+/gu)||[]).length<=8);
assert.ok(!rich.caption.includes('Entity:'));
assert.ok(!rich.caption.includes('Keyword:'));
assert.ok(!rich.caption.includes('metadata:'));
assert.ok(validateInstagramCaption(rich.caption,article).valid);

const duplicateArticle={...article,id:'caption-regression-2',content:`${longSentence(1)} ${longSentence(1)} ${longSentence(2)} ${longSentence(2)} ${longSentence(3)} ${longSentence(4)} ${longSentence(5)}`};
const duplicateCaption=buildInstagramCaption(duplicateArticle).caption;
assert.ok(!/(${longSentence(1).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})\\s+\\1/.test(duplicateCaption));

const short={id:'caption-regression-short',title:'Berita singkat hari ini',category:'Nasional',excerpt:'Satu fakta singkat disebut dalam artikel.',content:'Satu fakta singkat disebut dalam artikel.'};
const shortCaption=buildInstagramCaption(short);
assert.ok(shortCaption.caption.length<900);
assert.equal(shortCaption.captionLengthStatus,'TOO_SHORT_SOURCE_LIMITED');
assert.ok(!shortCaption.caption.includes('Informasi tambahan yang tidak ada'));

const seo=buildInstagramSeo(article);
assert.equal(seo.caption,rich.caption);
assert.ok(seo.primaryKeyword);
assert.ok(Array.isArray(seo.hashtags));
assert.ok(!seo.caption.includes('Keyword:'));

const publisherSource=await readFile(new URL('./social-run.js',import.meta.url),'utf8');
assert.match(publisherSource,/processing\.caption\|\|processing\.captionOriginal\|\|deterministicCaption/);
assert.doesNotMatch(publisherSource,/const caption=deterministicCaption\(processing\.article/);

const routeSource=await readFile(new URL('../app/api/admin/instagram/caption/route.js',import.meta.url),'utf8');
assert.match(routeSource,/if\(row\.captionEdited\)throw new Error\('manual_caption_protected'\)/);
assert.match(routeSource,/caption:seo\.caption/);
assert.doesNotMatch(routeSource,/cardUrls:/);

console.log(`instagram-caption-regression PASS length=${rich.captionLength} source=${rich.captionSourceLength}`);
