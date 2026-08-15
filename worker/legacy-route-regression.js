import assert from 'node:assert/strict';
import {isLegacyArticlePath,legacyIdFromPath,findLegacyArticleInMemory,legacyRedirectTarget} from '../lib/legacy-route.js';

const article={id:'current-stable-19382b3f',fingerprint:'current-stable-19382b3f',slug:'judul-baru',title:'Judul Baru',legacyId:'8b5f1575540d8257a5e4adaf'};
assert.equal(isLegacyArticlePath('/berita/8b5f1575540d8257a5e4adaf'),true);
assert.equal(isLegacyArticlePath('/berita/slug-19382b3f'),false);
assert.equal(legacyIdFromPath('/berita/8b5f1575540d8257a5e4adaf'),'8b5f1575540d8257a5e4adaf');
assert.equal(findLegacyArticleInMemory([article],'8b5f1575540d8257a5e4adaf'),article);
assert.equal(legacyRedirectTarget(article),'/berita/judul-baru-current-');
assert.equal(findLegacyArticleInMemory([article],'deadbeefdeadbeefdeadbeef'),null);
console.log('legacy route regression: PASS known mapping, unknown remains unresolved');
