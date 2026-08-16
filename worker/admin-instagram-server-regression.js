import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getInstagramReviewSnapshot,listInstagramReviewQueue} from '../lib/instagram-review.js';

const page=await readFile(new URL('../app/admin-instagram/page.jsx',import.meta.url),'utf8');
const dashboard=await readFile(new URL('../app/admin-instagram/InstagramDashboard.jsx',import.meta.url),'utf8');
const prepareRoute=await readFile(new URL('../app/api/admin/instagram/prepare-now/route.js',import.meta.url),'utf8');
const repairSource=await readFile(new URL('../lib/instagram-review-repair.js',import.meta.url),'utf8');
const retryRouteSource=await readFile(new URL('../app/api/admin/instagram/review/route.js',import.meta.url),'utf8');

assert.equal(typeof listInstagramReviewQueue,'function');
const snapshot=await getInstagramReviewSnapshot();
assert.ok(snapshot&&Array.isArray(snapshot.items));
assert.ok(Array.isArray(snapshot.ready));
assert.ok(snapshot.counts&&typeof snapshot.counts.ready==='number');
assert.match(page,/getInstagramReviewSnapshot/);
assert.match(dashboard,/Siapkan Postingan/);
assert.match(dashboard,/Sedang Menyiapkan/);
assert.match(dashboard,/prepare-now/);
assert.match(dashboard,/LOG PENYIAPAN POSTINGAN/);
assert.match(dashboard,/disabled=\{preparing\}/);
assert.match(prepareRoute,/requireAdmin/);
assert.match(prepareRoute,/prepareInstagramProductionQueue/);
assert.match(prepareRoute,/trigger:'admin-manual'/);
assert.match(prepareRoute,/status:200/);
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

console.log('Admin Instagram server regression: PASS authenticated manual preparation endpoint, button/processing UI, server-side logs, queue dependency, snapshot, stale card repair semantics, same queueId, resolved failure history, and failed-slide diagnostics');
