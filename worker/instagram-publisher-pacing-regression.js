import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getInstagramPublishPacing,INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS,INSTAGRAM_PUBLISH_CLOCK_TOLERANCE_MS} from '../lib/instagram-auto-upload.js';
import {classifyInstagramPublishFailure,isMetaActionThrottle,throttleBackoffMs} from '../lib/instagram-publish-queue.js';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const queue=read('lib/instagram-publish-queue.js');
const autoUpload=read('lib/instagram-auto-upload.js');
const automation=read('lib/instagram-automation.js');
const socialRun=read('worker/social-run.js');
const publisherRoute=read('app/api/cron/social-publish/route.js');
const code9Limit={metaCode:9,metaSubcode:2207042,message:'publishing limit reached'};
const code9Actions={metaCode:9,metaSubcode:2207069,message:'User is performing too many actions'};
const t0=Date.parse('2026-08-18T03:35:00.000Z');
const last={publishedAt:new Date(t0).toISOString(),nextAllowedAt:new Date(t0+INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS).toISOString()};

// A: exactly 15m after the successful publish is eligible with READY backlog.
assert.equal(INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS,15*60*1000);
assert.match(automation,/DEFAULT_AUTO_UPLOAD_INTERVAL_MINUTES=15/);
assert.equal(getInstagramPublishPacing(last,{now:t0+15*60*1000}).eligible,true);
// B: 14m is still protected by normal pacing.
assert.equal(getInstagramPublishPacing(last,{now:t0+14*60*1000}).eligible,false);
// F: scheduler clock drift must not lose the next 15m cycle.
assert.equal(getInstagramPublishPacing(last,{now:t0+15*60*1000+100}).eligible,true);
assert.equal(INSTAGRAM_PUBLISH_CLOCK_TOLERANCE_MS>=5*1000,true);
assert.equal(getInstagramPublishPacing(last,{now:t0+15*60*1000-100}).eligible,true);

// C: successful safe probe clears recovery state and returns to normal pacing.
assert.match(queue,/active:false,probeDue:false,reason:null,nextProbeAt:null,estimatedResumeAt:null/);
assert.match(autoUpload,/await clearInstagramPublishThrottle\(\{now:Date\.now\(\)\}\)/);
assert.match(autoUpload,/nextAllowedAt:base\.nextAllowedAt/);
assert.match(autoUpload,/INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS/);
// D: code 9 protection remains long-backoff + probe driven.
assert.equal(classifyInstagramPublishFailure(code9Limit).reason,'META_ACTION_THROTTLE');
assert.equal(classifyInstagramPublishFailure(code9Actions).reason,'META_ACTION_THROTTLE');
assert.equal(isMetaActionThrottle(code9Limit),true);
assert.equal(isMetaActionThrottle(code9Actions),true);
assert.equal(throttleBackoffMs(1),30*60*1000);
assert.equal(throttleBackoffMs(2),60*60*1000);
assert.match(queue,/META_ACTION_THROTTLE_SUBCODES/);
assert.match(queue,/acquireLock\(PROBE_LOCK/);
assert.match(queue,/probe-publish/);
assert.doesNotMatch(socialRun,/fallback=single_image/);
assert.doesNotMatch(socialRun,/metaSubcode\)===2207042/);
// E: one social-publish invocation has one candidate publish path; no queue drain loop.
assert.equal((autoUpload.match(/publishInstagramReviewItemQueued\(/g)||[]).length,1);
assert.doesNotMatch(autoUpload,/for\([^)]*queue|while\([^)]*queue/);
assert.match(autoUpload,/publishPosted=1/);
// Telemetry exposes deterministic normal pacing and required production fields.
for(const field of ['status','reason','ready','queued','throttleActive','lastSuccessAt','nextAllowedAt','intervalRemainingMs','metaPublishCalls','published','mediaId','durationMs'])assert.match(publisherRoute,new RegExp(field));
console.log('instagram publisher pacing regression: PASS 15m deterministic pacing + tolerance + safe-probe recovery clear + code9 long backoff + one-post-per-run + telemetry');
