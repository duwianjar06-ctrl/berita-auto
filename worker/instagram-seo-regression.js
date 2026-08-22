import assert from 'node:assert/strict';
import {buildInstagramSeo,validateInstagramArticleUrl,validateInstagramSeo} from '../lib/social.js';

const fixtures=[
{id:'auto-1',title:'Toyota Avanza Terbaru Hadir dengan Fitur Keselamatan Baru',excerpt:'Toyota memperbarui Avanza dengan fitur keselamatan baru untuk pasar Indonesia.',category:'Otomotif',sourceUrl:'https://example.com/toyota',sitePublishedAt:'2026-08-22T05:00:00.000Z'},
{id:'nas-1',title:'Kemensos Dirikan Dapur Umum untuk Korban Gempa Manggarai Timur',excerpt:'Kementerian Sosial menyiapkan dapur umum untuk membantu warga terdampak gempa.',category:'Nasional',sourceUrl:'https://example.com/gempa',sitePublishedAt:'2026-08-22T05:00:00.000Z'},
{id:'tech-1',title:'Google Perkenalkan Fitur AI Baru untuk Pengguna Android',excerpt:'Google memperkenalkan fitur AI baru yang membantu pengguna Android menyelesaikan tugas harian.',category:'Teknologi',sourceUrl:'https://example.com/google-ai',sitePublishedAt:'2026-08-22T05:00:00.000Z'}];
for(const article of fixtures){const seo=buildInstagramSeo(article);assert.ok(seo.headline);assert.ok(seo.caption.includes(article.title));assert.ok(seo.primaryKeyword);assert.equal(seo.category,article.category);assert.ok(seo.hashtags.length>=3&&seo.hashtags.length<=7);assert.equal(new Set(seo.hashtags.map(x=>x.toLowerCase())).size,seo.hashtags.length);assert.ok(seo.imageAltText);assert.equal(seo.seoStatus,'READY');assert.ok(validateInstagramArticleUrl(seo.articleUrl).valid);assert.ok(validateInstagramSeo(seo).valid);}
assert.equal(validateInstagramArticleUrl('https://berita-auto.vercel.app/kategori/otomotif').valid,false);
assert.equal(validateInstagramArticleUrl('https://berita-auto.vercel.app/tag/toyota').valid,false);
assert.equal(validateInstagramArticleUrl('https://berita-auto.vercel.app/search?q=toyota').valid,false);
assert.equal(validateInstagramArticleUrl('https://berita-auto.vercel.app/admin-instagram').valid,false);
const invalid=validateInstagramSeo({headline:'x',caption:'x',primaryKeyword:'x',category:'Otomotif',hashtags:['#Toyota','#Toyota'],imageAltText:'x',articleUrl:'https://berita-auto.vercel.app/kategori/otomotif'});
assert.equal(invalid.valid,false);assert.ok(invalid.errors.includes('DUPLICATE_HASHTAG'));assert.ok(invalid.errors.includes('INVALID_ARTICLE_URL_ROUTE'));
console.log('[instagram-seo] PASS: headline/caption/entities/keywords/3-7 hashtags/alt text/article URL validation covered');
