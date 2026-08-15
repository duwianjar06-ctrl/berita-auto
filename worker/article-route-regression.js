import assert from 'node:assert/strict';
import {articlePath,articleSlug,stableIdFromArticlePath,matchesArticleStableId} from '../lib/article-url.js';

const article={id:'1234567890abcdef',fingerprint:'1234567890abcdef',slug:'judul-baru',title:'Judul Baru'};
const oldPath='/berita/judul-lama-12345678';
const newPath=articlePath(article);

assert.equal(stableIdFromArticlePath(oldPath),'12345678');
assert.equal(matchesArticleStableId(article,oldPath),true);
assert.equal(articleSlug(article),'judul-baru-12345678');
assert.equal(newPath,'/berita/judul-baru-12345678');
assert.equal(matchesArticleStableId(article,'/berita/judul-lain-deadbeef'),false);
assert.notEqual(oldPath,newPath);

console.log('article route regression: PASS');
