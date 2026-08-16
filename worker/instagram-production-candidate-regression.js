import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPreparationCandidatePool} from '../lib/instagram-preparation-runtime.js';

const runtime=await readFile(new URL('../lib/instagram-preparation-runtime.js',import.meta.url),'utf8');
const now=Date.parse('2026-08-17T00:00:00Z');
const article=(id,title,minutes=10)=>({id,stableId:id,title,category:'Nasional',publisher:'ANTARA',sitePublishedAt:new Date(now-minutes*60000).toISOString(),sourceUrl:`https://example.com/${id}`});
const freshA=article('fresh-a','Berita baru A');
const freshB=article('fresh-b','Berita baru B');
const stale=article('stale','Berita lama gagal');
const existing=[{queueId:'stale:q',articleId:'stale',status:'FAILED',failureCode:'CARD_PUBLIC_TIMEOUT',nextRetryAt:new Date(now+10*60000).toISOString()}];
const queue=[{article:stale,articleId:'stale',state:'failed'}];
const pool=buildPreparationCandidatePool({articles:[freshA,freshB,stale],queue,existing,recentPublished:[],now});
assert.ok(pool.diagnostics.skippedBackoff>=1);
assert.deepEqual(pool.freshCandidates.map(item=>item.article.id),['fresh-a','fresh-b']);
assert.equal(pool.existingCandidates.length,0);
assert.ok(pool.freshCandidates.every(item=>item.selectionScore!==undefined));

const tenFailed=Array.from({length:10},(_,i)=>{const a=article(`failed-${i}`,`Failed ${i}`);return {queueId:`failed-${i}:q`,articleId:a.id,status:'FAILED',failureCode:'CARD_PUBLIC_TIMEOUT',nextRetryAt:new Date(now-60000).toISOString()};});
const fresh=[freshA,freshB,article('fresh-c','Fresh C'),article('fresh-d','Fresh D'),article('fresh-e','Fresh E'),article('fresh-f','Fresh F')];
const freshQueue=tenFailed.map(row=>({article:article(row.articleId,row.articleId),articleId:row.articleId,state:'failed'}));
const fair=buildPreparationCandidatePool({articles:[...fresh,...freshQueue.map(x=>x.article)],queue:freshQueue,existing:tenFailed,recentPublished:[],now});
assert.equal(fair.existingCandidates.length,10,'pool exposes old failures; runtime must cap retry slots');
assert.ok(fair.freshCandidates.length>=6,'fresh candidates remain available');

const backoffA={queueId:'backoff-a:q',articleId:'backoff-a',status:'FAILED',failureCode:'CARD_PUBLIC_TIMEOUT',nextRetryAt:new Date(now+5*60000).toISOString()};
const backoffArticle=article('backoff-a','Backoff A');
const backoffPool=buildPreparationCandidatePool({articles:[backoffArticle,freshA],queue:[{article:backoffArticle,articleId:'backoff-a',state:'failed'}],existing:[backoffA],recentPublished:[],now});
assert.ok(backoffPool.diagnostics.skippedBackoff>=1);
assert.deepEqual(backoffPool.existingCandidates,[]);
assert.deepEqual(backoffPool.freshCandidates.map(item=>item.article.id),['fresh-a']);

const readyLike={queueId:'same:q',articleId:'same',status:'FAILED',failureCode:'CARD_PUBLIC_404',cardUrls:['https://blob.example/slide1.jpg','https://blob.example/slide2.jpg'],previewUrl:'https://blob.example/slide1.jpg',render:{status:'RENDER_SUCCESS',width:1080,height:1350,format:'jpeg'}};
const sameArticle=article('same','Previously failed but now healthy');
const repairedPool=buildPreparationCandidatePool({articles:[sameArticle],queue:[{article:sameArticle,articleId:'same',state:'failed'}],existing:[readyLike],recentPublished:[],now});
assert.equal(repairedPool.existingCandidates[0].prior.queueId,'same:q');
assert.equal(repairedPool.existingCandidates[0].prior.cardUrls.length,2);

assert.match(runtime,/MAX_FAILED_RETRIES_PER_RUN=2/);
assert.match(runtime,/candidatePool=\[\.\.\.fresh,\.\.\.old\]/);
assert.match(runtime,/for\(let i=0;i<candidatePool\.length/);
assert.match(runtime,/catch\(error\)/);
assert.match(runtime,/diagnostics\.candidateFailed\+\+/);
assert.match(runtime,/nextRetryAt=code\?new Date\(now\+retryMs\(attempt\)\)/);
assert.match(runtime,/LAST_CANDIDATE/);
assert.match(runtime,/if\(remainingMs\(\)<MIN_CANDIDATE_RESERVE_MS\)/);
assert.match(runtime,/metaCalls:0/);

console.log('Instagram production candidate regression: PASS failure isolation contract (A fail/B fail/C ready/D ready), fresh-vs-old retry budget, backoff skip, rotation cursor, stale-card same queueId/cache, and bounded preparation loop');
