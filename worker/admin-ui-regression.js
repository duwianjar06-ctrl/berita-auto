import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../app/admin-berita/page.jsx',import.meta.url),'utf8');
const adsPage=await readFile(new URL('../app/admin-berita/iklan/page.jsx',import.meta.url),'utf8');
const adsUpload=await readFile(new URL('../app/api/admin/ads/upload/route.js',import.meta.url),'utf8');
const manager=await readFile(new URL('../components/admin/AdsManager.jsx',import.meta.url),'utf8');

assert.match(page,/href="\/admin-berita\/iklan" className="admin-link">Kelola Iklan/);
assert.match(page,/a\.paraphraseStatus==='success'/);
assert.match(page,/title="Konten berhasil diparafrase"/);
assert.match(adsPage,/const blobConfigured=Boolean\(process\.env\.BLOB_READ_WRITE_TOKEN\)/);
assert.match(adsPage,/Storage gambar belum dikonfigurasi/);
assert.match(adsUpload,/blob_storage_not_configured/);
assert.match(adsUpload,/status:503/);
assert.match(manager,/blobConfigured/);
assert.match(manager,/Storage gambar belum dikonfigurasi/);

console.log('PASS admin navigation exposes Kelola Iklan');
console.log('PASS admin list renders only authoritative paraphrase success badge');
console.log('PASS missing Blob configuration is fail-safe');
console.log('Admin UI regression: 3/3 passed');
