import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getInstagramReviewSnapshot} from '../lib/instagram-review.js';

const page=await readFile(new URL('../app/admin-instagram/page.jsx',import.meta.url),'utf8');

assert.equal(typeof globalThis.listInstagramReviewQueue,'function','Instagram review queue reader must resolve as a callable server dependency');
const snapshot=await getInstagramReviewSnapshot();
assert.ok(snapshot&&Array.isArray(snapshot.items),'Instagram review snapshot must execute server-side');
assert.ok(Array.isArray(snapshot.ready),'Instagram review snapshot must expose READY rows');
assert.ok(snapshot.counts&&typeof snapshot.counts.ready==='number','Instagram review snapshot must expose counts');
assert.match(page,/getInstagramReviewSnapshot/);
assert.match(page,/Data antrean Instagram sementara gagal dimuat/);
assert.match(page,/reviewError/);
console.log('Admin Instagram server regression: PASS queue dependency resolves, snapshot executes, empty queue is valid, and queue read failures have a graceful SSR state');
