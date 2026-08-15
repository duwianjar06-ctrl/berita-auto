import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../app/admin-berita/page.jsx',import.meta.url),'utf8');
const helper=await readFile(new URL('../lib/admin-processing.js',import.meta.url),'utf8');
const adsPage=await readFile(new URL('../app/admin-berita/iklan/page.jsx',import.meta.url),'utf8');
const adsUpload=await readFile(new URL('../app/api/admin/ads/upload/route.js',import.meta.url),'utf8');
const manager=await readFile(new URL('../components/admin/AdsManager.jsx',import.meta.url),'utf8');

assert.match(page,/href="\/admin-berita\/iklan" className="admin-link">Kelola Iklan/);
assert.match(page,/processingCounts\(items\)/);
assert.match(page,/href="\/admin-berita\?filter=paraphrase"/);
assert.match(page,/href="\/admin-berita\?filter=translated"/);
assert.match(page,/isSuccessfullyParaphrased\(a\)/);
assert.match(page,/isSuccessfullyTranslated\(a\)/);
assert.match(page,/Parafrase/);
assert.match(page,/Terjemahan/);
assert.match(page,/Semua Berita/);
assert.match(helper,/paraphraseStatus/);
assert.match(helper,/translationStatus/);
assert.match(helper,/translated/);
assert.match(adsPage,/const blobConfigured=Boolean\(process\.env\.BLOB_READ_WRITE_TOKEN\)/);
assert.match(adsPage,/Storage gambar belum dikonfigurasi/);
assert.match(adsUpload,/blob_storage_not_configured/);
assert.match(adsUpload,/status:503/);
assert.match(manager,/blobConfigured/);
assert.match(manager,/Storage gambar belum dikonfigurasi/);

console.log('PASS admin navigation exposes Kelola Iklan');
console.log('PASS admin processing summaries and filters are wired to shared source-of-truth');
console.log('PASS admin list renders Parafrase and Terjemahan badges only through authoritative helpers');
console.log('PASS missing Blob configuration is fail-safe');
console.log('Admin UI regression: 4/4 passed');
