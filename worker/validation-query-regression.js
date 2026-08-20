import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildArticleValidationQuery,ensureArticleValidationQuery,validateArticleValidationQuery,buildArticleSearchQuery,validateArticleSearchQuery} from '../lib/validation-query.js';

const cases=[
 {title:'Kemensos Dirikan 3 Dapur Umum Layani Korban Gempa di Manggarai Timur',primaryQuery:'gempa manggarai hari ini',expect:['kemensos','3','gempa','manggarai','timur']},
 {title:'Video: Kebakaran Hutan Kepung Kalimantan',primaryQuery:'kebakaran hutan kalimantan hari ini',expect:['kebakaran','hutan','kalimantan']},
 {title:'Kapan Pembatasan Pertalite Berlaku? Ini Penjelasan Purbaya dan Bahlil',primaryQuery:'pembatasan pertalite kapan berlaku',expect:['pertalite','purbaya','bahlil']},
 {title:'Pemerintah Bakal Buka Seleksi CPNS 2027, Guru Diprioritaskan',primaryQuery:'cpns 2027 kapan dibuka',expect:['cpns','2027','guru']},
 {title:'Hasil La Liga Atletico Madrid vs Malaga, Pemain Pengganti Pastikan Kemenangan',primaryQuery:'hasil atletico madrid vs malaga',expect:['atletico','madrid','malaga','la','liga']},
 {title:'Honda Meluncurkan Vario X dengan Mesin Baru',primaryQuery:'harga honda vario x',expect:['honda','vario','mesin']},
 {title:'Trump Pamer Kontak Kim Jong Un, Adiknya Langsung Bilang Begini',primaryQuery:'trump kim jong un terbaru',expect:['trump','kim','jong','un']},
 {title:'Samsung X Resmi Meluncur dengan Kamera Baru',primaryQuery:'harga samsung x',expect:['samsung','x','kamera']},
 {title:'Gempa NTT Kembali Guncang Wilayah Timur',primaryQuery:'gempa ntt hari ini',expect:['gempa','ntt']},
 {title:'PGE Target Jadi Geothermal Terbesar Dunia 2034',primaryQuery:'target pge geothermal 2034',expect:['pge','geothermal','2034']}
];
for(const article of cases){const q=buildArticleValidationQuery(article);const v=validateArticleValidationQuery(q,article);assert(v.valid,`invalid validation query: ${q}`);assert.match(q,/Berita Auto/);assert.match(q,/berita-auto\.vercel\.app/);assert.doesNotMatch(q,/\b(?:site|intitle|inurl):/i);assert.doesNotMatch(q,/["'+]/);for(const token of article.expect)assert(q.toLowerCase().includes(token.toLowerCase()),`missing ${token}: ${q}`);assert.notEqual(q,article.primaryQuery);}
const manggarai={title:'Kemensos Dirikan Dapur Umum untuk Korban Gempa Manggarai Timur',primaryQuery:'gempa manggarai hari ini'};const mq=buildArticleValidationQuery(manggarai);assert.match(mq,/manggarai/i);assert.doesNotMatch(mq,/jakarta/i);assert.doesNotMatch(mq,/harga/i);assert.doesNotMatch(mq,/jadwal/i);
const automotive={title:'Honda Meluncurkan Vario X dengan Mesin Baru',primaryQuery:'harga honda vario x'};const aq=buildArticleValidationQuery(automotive);assert.doesNotMatch(aq,/\bharga\b/i,'validation query should not invent price intent');
const utility=ensureArticleValidationQuery(manggarai);assert.equal(utility.validationQuery,mq);assert.equal(typeof utility.validationQueryQuality.quality,'number');assert.notEqual(utility.validationQuery,manggarai.primaryQuery);
assert.doesNotMatch(buildArticleValidationQuery({title:'Atletico Madrid vs Malaga',primaryQuery:'hasil atletico madrid vs malaga'}),/vs kompetitor/i);

const articleSearchCases=[
 {title:'KemenPUPR Percepat Penanganan Infrastruktur Jalan Terdampak Gempa NTT',primaryQuery:'kemenpupr penanganan infrastruktur gempa ntt'},
 {title:'Video: Kebakaran Hutan Kepung Kalimantan',primaryQuery:'kebakaran hutan kalimantan hari ini'},
 {title:'Trump Pamer Kontak Kim Jong Un, Adiknya Langsung Bilang Begini',primaryQuery:'trump kim jong un terbaru'},
 {title:'Pemerintah Bakal Buka Seleksi CPNS 2027, Guru Diprioritaskan',primaryQuery:'cpns 2027 kapan dibuka'},
 {title:'Kapan Pembatasan Pertalite Berlaku? Ini Penjelasan Purbaya dan Bahlil',primaryQuery:'pembatasan pertalite kapan berlaku'},
 {title:'Hasil La Liga Atletico Madrid vs Malaga, Pemain Pengganti Pastikan Kemenangan',primaryQuery:'hasil atletico madrid vs malaga'},
 {title:'Honda Meluncurkan Vario X dengan Mesin Baru',primaryQuery:'harga honda vario x'},
 {title:'Samsung X Resmi Meluncur dengan Kamera Baru',primaryQuery:'harga samsung x'}
];
for(const article of articleSearchCases){const q=buildArticleSearchQuery(article);const v=validateArticleSearchQuery(q,article);assert(v.valid,`invalid article search query: ${q}`);assert.match(q,/Berita Auto$/);assert.doesNotMatch(q,/\b(?:site|intitle|inurl):/i);assert.doesNotMatch(q,/["'+]/);assert.ok(q.split(/\s+/).length<=13,`query too long: ${q}`);assert.doesNotMatch(q,/vs kompetitor/i);assert.notEqual(q,article.primaryQuery);}
const locationArticle={title:'KemenPUPR Percepat Penanganan Infrastruktur Jalan Terdampak Gempa Manggarai Timur',primaryQuery:'kemenpupr penanganan infrastruktur gempa manggarai timur'};const locationQuery=buildArticleSearchQuery(locationArticle);assert.match(locationQuery,/manggarai/i);assert.doesNotMatch(locationQuery,/jakarta/i);assert.doesNotMatch(locationQuery,/\bharga\b/i);assert.doesNotMatch(locationQuery,/\bjadwal\b/i);
const noPrice={title:'Honda Meluncurkan Vario X dengan Mesin Baru',primaryQuery:'harga honda vario x'};assert.doesNotMatch(buildArticleSearchQuery(noPrice),/\bharga\b/i);
const adminSource=readFileSync(new URL('../app/admin-berita/AdminWorkspace.jsx',import.meta.url),'utf8');assert.match(adminSource,/Cek Google/);assert.match(adminSource,/Cari Artikel/);assert.match(adminSource,/Cek URL/);assert.match(adminSource,/encodeURIComponent\(url\)/);assert.match(adminSource,/encodeURIComponent\(m\.primaryQuery\)/);assert.match(adminSource,/article\.canonicalUrl/);assert.match(adminSource,/target="_blank"/i)===undefined;
const encoded=encodeURIComponent('https://berita-auto.vercel.app/berita/kemenpupr-percepat-penanganan-infrastruktur-gempa-ntt');assert.match(encoded,/%3A/);assert.match(encoded,/%2F/);
console.log('Validation/discovery regression: PASS primary-query separation, article-search quality, URL discovery safety, entity/location relevance, operator safety, branding, and admin actions');
