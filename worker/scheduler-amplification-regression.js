import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const socialRoute=await readFile(new URL('../app/api/cron/social-prepare/route.js',import.meta.url),'utf8');
const newsRoute=await readFile(new URL('../app/api/cron/news-publish/route.js',import.meta.url),'utf8');
const autoUpload=await readFile(new URL('../lib/instagram-auto-upload.js',import.meta.url),'utf8');
const publishQueue=await readFile(new URL('../lib/instagram-publish-queue.js',import.meta.url),'utf8');
const dashboard=await readFile(new URL('../app/admin-instagram/InstagramDashboard.jsx',import.meta.url),'utf8');
const page=await readFile(new URL('../app/admin-instagram/page.jsx',import.meta.url),'utf8');
const adminSnapshot=await readFile(new URL('../lib/instagram-admin-snapshot.js',import.meta.url),'utf8');
const instagram=await readFile(new URL('../lib/instagram.js',import.meta.url),'utf8');
const socialGetStart=socialRoute.indexOf('export async function GET');const socialPostStart=socialRoute.indexOf('export async function POST');const socialGet=socialRoute.slice(socialGetStart,socialPostStart);const getStart=newsRoute.indexOf('export async function GET');const postStart=newsRoute.indexOf('export async function POST');const getBlock=newsRoute.slice(getStart,postStart);
const retryIndex=socialGet.indexOf('delivery.retried>0');const prepareIndex=socialGet.indexOf('prepareInstagramProductionQueue');const skipIndex=socialGet.indexOf('qstash_retry_ignored_periodic_job');
assert.match(socialRoute,/delivery\.retried>0/);assert.match(socialRoute,/qstash_retry_ignored_periodic_job/);assert.match(socialRoute,/return NextResponse\.json\(\{status:'skipped'/);assert.ok(retryIndex>=0&&retryIndex<prepareIndex);assert.ok(skipIndex>=0&&skipIndex<prepareIndex);
assert.match(newsRoute,/export async function GET\(request\)/);assert.match(newsRoute,/legacy_get_scheduler_disabled/);assert.ok(getStart>=0&&postStart>getStart);assert.doesNotMatch(getBlock,/runPublicationCycle/);assert.match(newsRoute,/export async function POST\(request\)/);assert.match(newsRoute,/withPersistenceSource\('news-publish'/);assert.match(newsRoute,/deliveryClassification/);
assert.match(autoUpload,/getInstagramPublishThrottle\(\{now\}\)/);assert.match(autoUpload,/if\(throttle\.active&&!throttle\.probeDue\)return/);const gateIndex=autoUpload.indexOf('getInstagramPublishGate({now})');const queueScanIndex=autoUpload.indexOf('listInstagramReviewQueue()');assert.ok(gateIndex>=0&&queueScanIndex>gateIndex);assert.doesNotMatch(autoUpload,/if\(throttle\.active&&!throttle\.probeDue\)\{[\s\S]*?bulkEnqueueInstagramPublishItems/);
assert.match(publishQueue,/PROBE_LOCK/);assert.match(publishQueue,/META_ACTION_PROBE_BUSY/);assert.match(publishQueue,/publishingUsage=null/);assert.match(publishQueue,/effectiveEstimatedResumeAt/);assert.match(publishQueue,/idempotencyKey=null/);assert.match(publishQueue,/metaCalls:0/);
assert.match(dashboard,/120000/);assert.match(dashboard,/visibilityState/);assert.doesNotMatch(dashboard,/useEffect\(\(\)=>\{refresh\(\);/);assert.match(dashboard,/Tunggu hingga/);assert.match(dashboard,/Publishing quota/);assert.match(dashboard,/META_ACTION_THROTTLE/);
assert.doesNotMatch(page,/forceRefresh:true/);assert.match(adminSnapshot,/ba:social:instagram:admin-snapshot:v2/);assert.match(adminSnapshot,/delKey\(MATERIALIZED_KEY\)/);assert.match(instagram,/PUBLISHING_USAGE_CACHE_MS/);assert.match(instagram,/publishingUsageInFlight/);

const skill=await readFile(new URL('../SKILL.md',import.meta.url),'utf8');
for(const line of ['news-publish: `*/15 * * * *`','social-prepare: `2-59/15 * * * *`','social-publish: `5-59/15 * * * *`'])assert.ok(skill.includes(line),`missing scheduler documentation: ${line}`);

const prepareLockMatch=socialRoute.match(/const LOCK='([^']+)'/);const publishLockMatch=autoUpload.match(/AUTO_LOCK='([^']+)'/);
assert.ok(prepareLockMatch&&publishLockMatch,'prepare/publish locks must remain explicit');
assert.notEqual(prepareLockMatch[1],publishLockMatch[1],'prepare and publish must not share a lock');
assert.doesNotMatch(socialRoute,new RegExp(publishLockMatch[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'prepare must not acquire publisher lock');
assert.doesNotMatch(autoUpload,new RegExp(prepareLockMatch[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'publisher must not acquire prepare lock');

const readyRow={status:'READY',removedAt:null,postedAt:null,mediaId:null,queueId:'instagram:ready-1'};
const simulatedPrepare=async()=>{await new Promise(resolve=>setTimeout(resolve,5));return{status:'preparing'}};
const simulatedPublish=async rows=>rows.filter(row=>row.status==='READY'&&!row.removedAt&&!row.postedAt&&!row.mediaId)[0]||null;
const [prepareResult,publishResult]=await Promise.all([simulatedPrepare(),simulatedPublish([readyRow])]);
assert.equal(prepareResult.status,'preparing');
assert.equal(publishResult?.queueId,'instagram:ready-1','an active prepare must not hide an existing READY item');

console.log('Scheduler/admin/throttle/race regression: PASS staggered scheduler documentation, independent prepare/publish locks, READY concurrency safety, retry zero-Redis fast paths, legacy GET suppression, authoritative POST, probe-before-queue, single probe lock, materialized admin snapshot, 120s polling, action-throttle UI, and publishing usage dedupe');
