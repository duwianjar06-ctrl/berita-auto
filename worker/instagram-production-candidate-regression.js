import assert from 'node:assert/strict';
import {buildPreparationCandidatePool} from '../lib/instagram-preparation-runtime.js';

const now=Date.parse('2026-08-17T00:00:00Z');
const article=(id,title,minutes=10)=>({id,stableId:id,title,category:'Nasional',publisher:'ANTARA',sitePublishedAt:new Date(now-minutes*60000).toISOString(),sourceUrl:`https://example.com/${id}`});
const freshA=article('fresh-a','Berita baru A');
const freshB=article('fresh-b','Berita baru B');
const stale=article('stale','Berita lama gagal');
const existing=[{queueId:'stale:q',articleId:'stale',status:'FAILED',failureCode:'CARD_PUBLIC_TIMEOUT',nextRetryAt:new Date(now+10*60000).toISOString()}];
const queue=[{article:stale,articleId:'stale',state:'failed',nextRetryAt:new Date(now+10*60000).toISOString()}];
const pool=buildPreparationCandidatePool({articles:[freshA,freshB,stale],queue,existing,recentPublished:[],now});
assert.equal(pool.diagnostics.skippedBackoff,1);
assert.deepEqual(pool.freshCandidates.map(item=>item.article.id),['fresh-a','fresh-b']);
assert.equal(pool.existingCandidates.length,0);
assert.ok(pool.freshCandidates.every(item=>item.selectionScore!==undefined));

const duplicateQueue=[{article:freshA,articleId:'fresh-a',state:'queued'}];
const duplicatePool=buildPreparationCandidatePool({articles:[freshA,freshB],queue:duplicateQueue,existing:[],recentPublished:[],now});
assert.deepEqual(duplicatePool.freshCandidates.map(item=>item.article.id),['fresh-b']);
assert.deepEqual(duplicatePool.existingCandidates.map(item=>item.article.id),['fresh-a']);

console.log('Instagram production candidate regression: PASS fresh candidates bypass stale/backoff queue starvation and dedupe correctly');
