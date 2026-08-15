import assert from 'node:assert/strict';
import {articlePath,articleSlug,stableIdFromArticlePath,matchesArticleStableId} from '../lib/article-url.js';
import {isLegacyArticlePath,legacyIdFromPath,findLegacyArticleInMemory} from '../lib/legacy-route.js';

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

console.log('article route regression: PASS stable-id + legacy resolver');