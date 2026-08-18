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
const interval=5*60*1000;
const last={publishedAt:new Date(t0).toISOString(),nextAllowedAt:new Date(t0+interval).toISOString()};

// A: exactly 5m after the successful publish is eligible with READY backlog.
assert.equal(INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS,5*60*1000);
assert.equal(automation.match(/DEFAULT_AUTO_UPLOAD_INTERVAL_MINUTES=5/g)?.length,1);
assert.equal(getInstagramPublishPacing(last,{now:t0+5*60*1000}).eligible,true);
// B: 4m remains protected by normal pacing.
assert.equal(getInstagramPublishPacing(last,{now:t0+4*60*1000}).eligible,false);
// C: 30s scheduler tolerance allows a slightly early tick, while 5m remains the normal boundary.
assert.equal(INSTAGRAM_PUBLISH_CLOCK_TOLERANCE_MS,30*1000);
assert.equal(getInstagramPublishPacing(last,{now:t0+4*60*1000+29*1000}).eligible,false);
assert.equal(getInstagramPublishPacing(last,{now:t0+4*60*1000+30*1000}).eligible,true);
assert.equal(getInstagramPublishPacing(last,{now:t0+5*60*1000+100}).eligible,true);
// D: scheduler cadence T+0, T+5, T+10 is eligible after each successful publish.
for(const offset of [0,5,10]){
  const successAt=t0+offset*60*1000;
  const cycle={publishedAt:new Date(successAt).toISOString(),nextAllowedAt:new Date(successAt+interval).toISOString()};
  assert.equal(getInstagramPublishPacing(cycle,{now:successAt+5*60*1000}).eligible,true);
}
// E: successful publish persists nextAllowedAt exactly +5m from the actual successful time.
const successAt=Date.parse('2026-08-18T03:35:34.000Z');
const expectedNext=successAt+5*60*1000;
const successRecord={publishedAt:new Date(successAt).toISOString(),nextAllowedAt:new Date(expectedNext).toISOString()};
assert.equal(Date.parse(getInstagramPublishPacing(successRecord,{now:successAt}).nextAllowedAt),expectedNext);
assert.equal(getInstagramPublishPacing(successRecord,{now:expectedNext}).eligible,true);

// F: safe-probe recovery clears throttle state and returns to normal pacing.
assert.match(queue,/active:false,probeDue:false,reason:null,nextProbeAt:null,estimatedResumeAt:null/);
assert.match(autoUpload,/await clearInstagramPublishThrottle\(\{now:Date\.now\(\)\}\)/);
assert.match(autoUpload,/nextAllowedAt:base\.nextAllowedAt/);
assert.match(autoUpload,/INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS/);
// G: Meta action throttle remains authoritative long-backoff + probe driven.
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
// H: one social-publish invocation has one candidate publish path; READY=10 cannot drain the queue.
assert.equal((autoUpload.match(/publishInstagramReviewItemQueued\(/g)||[]).length,1);
assert.doesNotMatch(autoUpload,/for\([^)]*queue|while\([^)]*queue/);
assert.match(autoUpload,/publishPosted=1/);
// I: telemetry exposes the required production fields and 5m interval.
assert.match(autoUpload,/normalIntervalMs:INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS/);
for(const field of ['status','reason','ready','queued','throttleActive','lastSuccessAt','nextAllowedAt','intervalRemainingMs','metaPublishCalls','published','mediaId','durationMs'])assert.match(publisherRoute,new RegExp(field));
console.log('instagram publisher pacing regression: PASS 5m deterministic pacing + 30s tolerance + T/T+5/T+10 cadence + success nextAllowedAt + code9 long backoff + one-post-per-run + telemetry');
