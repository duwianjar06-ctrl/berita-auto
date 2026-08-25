import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildInstagramCaption,validateInstagramCaption,getInstagramCaptionSource} from '../lib/instagram-caption.js';
import {buildInstagramSeo} from '../lib/social.js';

const longSentence=(i)=>`Pada ${10+(i%18)} Agustus 2026, Arsenal dan Manchester City menjadi perhatian setelah pertandingan berlangsung di London dengan hasil ${2+i%3}-${1+i%2}. Menurut laporan artikel, keputusan tersebut berdampak pada persiapan kedua tim dan angka ${100+i} tercatat dalam data pertandingan.`;
const longArticle=Array.from({length:55},(_,i)=>longSentence(i)).join(' ');
const article={id:'caption-regression-v3',slug:'caption-regression-v3',title:'Arsenal dan Manchester City menjadi perhatian setelah pertandingan',category:'Olahraga',publisher:'Reuters',content:longArticle,excerpt:'Ringkasan singkat yang tidak boleh menjadi sumber utama ketika content tersedia.'};

const rich=buildInstagramCaption(article);
assert.equal(rich.captionSourceLength,longArticle.length);
assert.equal(getInstagramCaptionSource(article).sourceField,'content');
assert.equal(rich.captionGeneratedBy,'deterministic-rich');
assert.equal(rich.captionGeneratorVersion,'rich-v3');
assert.ok(rich.factCount>=8,`expected >=8 facts, got ${rich.factCount}`);
assert.ok(rich.captionLength>=900,`expected adaptive rich caption >=900, got ${rich.captionLength}`);
assert.ok(rich.captionLength<=2100,`expected <=2100, got ${rich.captionLength}`);
assert.ok(rich.caption.split(/\n\n/).length>=5,`expected >=5 paragraphs, got ${rich.caption.split(/\n\n/).length}`);
assert.ok(rich.caption.includes('Arsenal'));
assert.ok(rich.caption.includes('London'));
assert.ok(rich.caption.includes('#BeritaAuto'));
assert.ok(rich.caption.endsWith('https://berita-auto.vercel.app/berita/caption-regression-v3'));
assert.equal((rich.caption.match(/https:\/\/[^\s]+/g)||[]).length,1);
assert.ok((rich.caption.match(/#[\p{L}\p{N}_-]+/gu)||[]).length<=8);
assert.ok(validateInstagramCaption(rich.caption,article).hardValid);
assert.ok(rich.captionSourceHash);
assert.ok(rich.captionCoverage.score>=0&&rich.captionCoverage.score<=100);
assert.ok(rich.captionRichness.uniqueFacts>=8);

const duplicateArticle={...article,id:'caption-regression-duplicate',content:`${longSentence(1)} ${longSentence(1)} ${longSentence(2)} ${longSentence(2)} ${longSentence(3)} ${longSentence(4)} ${longSentence(5)}`};
const duplicateCaption=buildInstagramCaption(duplicateArticle).caption;
assert.ok((duplicateCaption.match(/Arsenal/g)||[]).length<10,'duplicate content should be reduced');

const medium={id:'caption-regression-medium',slug:'caption-regression-medium',title:'Pemerintah menyampaikan perkembangan kebijakan baru',category:'Nasional',content:'Pemerintah menyampaikan perkembangan kebijakan baru di Jakarta. Pernyataan itu diberikan setelah evaluasi sejumlah program yang sedang berjalan. Pemerintah menyebut langkah berikutnya akan disesuaikan dengan hasil evaluasi dan kondisi di lapangan.'};
const mediumCaption=buildInstagramCaption(medium);
const mediumValidation=validateInstagramCaption(mediumCaption.caption,medium);
assert.ok(mediumCaption.caption.length<700,'medium source should not be forced to 700 characters');
assert.ok(mediumValidation.hardValid);
assert.equal(mediumCaption.captionQualityTarget.status,'SOURCE_LIMITED');

const short={id:'caption-regression-short-v3',slug:'caption-regression-short-v3',title:'Berita singkat hari ini',category:'Nasional',content:'Pemerintah menyampaikan perkembangan terbaru di Jakarta dalam keterangan singkat hari ini.'};
const shortCaption=buildInstagramCaption(short);
const shortValidation=validateInstagramCaption(shortCaption.caption,short);
assert.ok(shortCaption.caption.length<700);
assert.ok(shortValidation.hardValid);
assert.equal(shortCaption.captionQualityTarget.status,'SOURCE_LIMITED');
assert.ok(shortCaption.caption.endsWith('https://berita-auto.vercel.app/berita/caption-regression-short-v3'));
assert.ok(!shortCaption.caption.includes('Informasi tambahan yang tidak ada'));

const hardInvalid='Caption valid secara bentuk tetapi memiliki angka 99999 yang tidak terdapat pada artikel.\n\n#BeritaAuto\n\nBaca berita lengkap di Berita Auto:\nhttps://berita-auto.vercel.app/berita/hard-invalid';
const hardArticle={id:'hard-invalid',slug:'hard-invalid',title:'Berita angka',category:'Nasional',content:'Pemerintah menyampaikan hasil evaluasi di Jakarta pada 2026.',sitePublishedAt:'2026-08-25T00:00:00Z',sourceUrl:'https://example.com/news'};
const hardValidation=validateInstagramCaption(hardInvalid,hardArticle);
assert.equal(hardValidation.hardValid,false);
assert.ok(hardValidation.hardErrors.includes('UNSUPPORTED_NUMBER'));

const softCaption=`Pemerintah menyampaikan hasil evaluasi di Jakarta pada 2026.\n\n#BeritaAuto\n\nBaca berita lengkap di Berita Auto:\nhttps://berita-auto.vercel.app/berita/soft-pass`;
const softArticle={id:'soft-pass',slug:'soft-pass',title:'Pemerintah menyampaikan hasil evaluasi',category:'Nasional',content:'Pemerintah menyampaikan hasil evaluasi di Jakarta pada 2026. Informasi sumber memang terbatas sehingga caption dibuat ringkas.',sitePublishedAt:'2026-08-25T00:00:00Z',sourceUrl:'https://example.com/news'};
const softValidation=validateInstagramCaption(softCaption,softArticle);
assert.ok(softValidation.hardValid);
assert.ok(softValidation.softWarnings.length>=0);
assert.equal(typeof softValidation.qualityValid,'boolean');

const canonical={...article,id:'caption-regression-canonical',slug:'canonical-slug',canonicalUrl:'https://berita-auto.vercel.app/berita/canonical-slug'};
const canonicalCaption=buildInstagramCaption(canonical);
assert.ok(canonicalCaption.caption.endsWith(canonical.canonicalUrl));
assert.equal(canonicalCaption.articleUrl,canonical.canonicalUrl);

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

console.log(`instagram-caption-regression PASS length=${rich.captionLength} source=${rich.captionSourceLength} facts=${rich.factCount} coverage=${rich.captionCoverage.score}`);