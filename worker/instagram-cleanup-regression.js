import assert from 'node:assert/strict';
import {selectLegacyInstagramCandidates} from '../lib/instagram-review-cleanup.js';
const cutoverAt='2026-08-17T10:00:00.000Z';
const rows=[
  {queueId:'ready-old',status:'READY',preparedAt:'2026-08-17T09:00:00.000Z'},
  {queueId:'failed-old',status:'FAILED',preparedAt:'2026-08-17T09:01:00.000Z'},
  {queueId:'waiting-old',status:'WAITING_META',preparedAt:'2026-08-17T09:02:00.000Z'},
  {queueId:'queued-old',status:'QUEUED',preparedAt:'2026-08-17T09:03:00.000Z'},
  {queueId:'preparing-old',status:'PREPARING',preparedAt:'2026-08-17T09:04:00.000Z'},
  {queueId:'posted',status:'POSTED',preparedAt:'2026-08-17T09:00:00.000Z',postedAt:'2026-08-17T09:30:00.000Z',mediaId:'media-1'},
  {queueId:'publishing',status:'PUBLISHING',preparedAt:'2026-08-17T09:00:00.000Z'},
  {queueId:'media',status:'READY',preparedAt:'2026-08-17T09:00:00.000Z',mediaId:'media-2'},
  {queueId:'new',status:'READY',preparedAt:'2026-08-17T11:00:00.000Z'}
];
const selected=selectLegacyInstagramCandidates(rows,{cutoverAt});
assert.deepEqual(selected.map(row=>row.queueId),['ready-old','failed-old','waiting-old','queued-old','preparing-old']);
assert.equal(selected.some(row=>row.queueId==='posted'),false);
assert.equal(selected.some(row=>row.queueId==='publishing'),false);
assert.equal(selected.some(row=>row.queueId==='media'),false);
assert.equal(selected.some(row=>row.queueId==='new'),false);
console.log('[instagram-cleanup] PASS: safe cutover filter preserves POSTED/PUBLISHING/mediaId and selects only pre-cutover unposted rows');
