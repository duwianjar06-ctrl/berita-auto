import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getInstagramReviewSnapshot,listInstagramReviewQueue} from '../lib/instagram-review.js';

const page=await readFile(new URL('../app/admin-instagram/page.jsx',import.meta.url),'utf8');
const repairSource=await readFile(new URL('../lib/instagram-review-repair.js',import.meta.url),'utf8');
const retryRouteSource=await readFile(new URL('../app/api/admin/instagram/review/route.js',import.meta.url),'utf8');

assert.equal(typeof listInstagramReviewQueue,'function','Instagram review queue reader must resolve as a callable server dependency');
const snapshot=await getInstagramReviewSnapshot();
assert.ok(snapshot&&Array.isArray(snapshot.items),'Instagram review snapshot must execute server-side');
assert.ok(Array.isArray(snapshot.ready),'Instagram review snapshot must expose READY rows');
assert.ok(snapshot.counts&&typeof snapshot.counts.ready==='number','Instagram review snapshot must expose counts');
assert.match(page,/getInstagramReviewSnapshot/);
assert.match(page,/Data antrean Instagram sementara gagal dimuat/);
assert.match(page,/reviewError/);

assert.match(repairSource,/export async function repairInstagramReviewItem/);
assert.match(repairSource,/candidateInput\.cardUrls=row\.cardUrls/);
assert.match(repairSource,/status:'READY'/);
assert.match(repairSource,/failureCode:null/);
assert.match(repairSource,/failureStage:null/);
assert.match(repairSource,/failureMessage:null/);
assert.match(repairSource,/failureDetail:null/);
assert.match(repairSource,/resolvedFailure/);
assert.match(repairSource,/failedSlide/);
assert.match(repairSource,/repairHistory:/);
assert.match(repairSource,/queueId:row\.queueId/);
assert.match(retryRouteSource,/repairInstagramReviewItem/);
assert.match(retryRouteSource,/status:result\.recovered\?'recovered':'retry_failed'/);

console.log('Admin Instagram server regression: PASS queue dependency, snapshot, stale card repair semantics, same queueId, resolved failure history, failed-slide diagnostics, and immediate retry path');
