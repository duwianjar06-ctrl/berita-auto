import assert from 'node:assert/strict';
import {articlePath,articleSlug,stableIdFromArticlePath,matchesArticleStableId} from '../lib/article-url.js';
import {isLegacyArticlePath,legacyIdFromPath,findLegacyArticleInMemory} from '../lib/legacy-route.js';
import {mergeDurableArticles,readHistoricalRecovery} from '../lib/storage.js';

const article={id:'1234567890abcdef',fingerprint:'1234567890abcdef',slug:'judul-baru',title:'Judul Baru'};
const oldPath='/berita/judul-lama-12345678';
const newPath=articlePath(article);

assert.equal(stableIdFromArticlePath(oldPath),'12345678');
assert.equal(matchesArticleStableId(article,oldPath),true);
assert.equal(articleSlug(article),'judul-baru-12345678');
assert.equal(newPath,'/berita/judul-baru-12345678');
assert.equal(matchesArticleStableId(article,'/berita/judul-lain-deadbeef'),false);
assert.notEqual(oldPath,newPath);

const legacyArticle={id:'1234567890abcdef',fingerprint:'1234567890abcdef',slug:'judul-baru',title:'Judul Baru',legacyId:'8b5f1575540d8257a5e4adaf'};
assert.equal(isLegacyArticlePath('/berita/8b5f1575540d8257a5e4adaf'),true);
assert.equal(legacyIdFromPath('/berita/8b5f1575540d8257a5e4adaf'),'8b5f1575540d8257a5e4adaf');
assert.equal(findLegacyArticleInMemory([legacyArticle],'8b5f1575540d8257a5e4adaf'),legacyArticle);
assert.equal(findLegacyArticleInMemory([legacyArticle],'deadbeefdeadbeefdeadbeef'),null);
assert.equal(isLegacyArticlePath('/berita/judul-baru-12345678'),false);

const archive=[{id:'old',fingerprint:'old',title:'old',category:'Nasional'},{id:'new',fingerprint:'new',title:'new',category:'Teknologi'}];
const merged=mergeDurableArticles(archive,[{id:'new',fingerprint:'new',title:'new updated',category:'Sains'}]);
assert.equal(merged.length,2,'bounded incoming writes must not delete older published archive records');
assert.equal(merged.find(x=>x.id==='old')?.title,'old');
assert.equal(merged.find(x=>x.id==='new')?.category,'Sains');
const feedLimited=archive.slice(0,1);
assert.equal(mergeDurableArticles(archive,feedLimited).length,2,'feed/pagination limits must not mutate durable archive');
assert.equal(mergeDurableArticles(archive,[{id:'new',fingerprint:'new',category:'Sains'}]).find(x=>x.id==='new')?.fingerprint,'new','stable ID must be preserved during reclassification');
const historical=await readHistoricalRecovery();
assert.equal(historical.some(x=>x.id==='19382b3f6009f836a9dc3b1a'),true,'historical recovery manifest must retain authoritative stable ID');
assert.equal(historical.find(x=>x.id==='19382b3f6009f836a9dc3b1a')?.category,'Nasional');

console.log('article route regression: PASS stable-id + legacy resolver + durable archive + historical recovery');