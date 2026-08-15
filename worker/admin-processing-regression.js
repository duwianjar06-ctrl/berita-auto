import assert from 'node:assert/strict';
import {filterByProcessingStatus,isSuccessfullyParaphrased,isSuccessfullyTranslated,processingCounts} from '../lib/admin-processing.js';

const articles=[
  {id:'p1',paraphraseStatus:'success',translationStatus:'translated'},
  {id:'p2',paraphraseStatus:'success',translationStatus:'fallback'},
  {id:'p3',paraphraseStatus:'fallback',translationStatus:'translated'},
  {id:'p4',paraphraseStatus:'failed',translationStatus:'failed'},
  {id:'p5'},
];

const counts=processingCounts(articles);
assert.deepEqual(counts,{paraphrase:2,translation:2});
assert.equal(isSuccessfullyParaphrased(articles[0]),true);
assert.equal(isSuccessfullyParaphrased(articles[1]),true);
assert.equal(isSuccessfullyParaphrased(articles[2]),false);
assert.equal(isSuccessfullyParaphrased(articles[3]),false);
assert.equal(isSuccessfullyParaphrased(articles[4]),false);
assert.equal(isSuccessfullyTranslated(articles[0]),true);
assert.equal(isSuccessfullyTranslated(articles[1]),false);
assert.equal(isSuccessfullyTranslated(articles[2]),true);
assert.equal(isSuccessfullyTranslated(articles[3]),false);
assert.equal(isSuccessfullyTranslated(articles[4]),false);
assert.deepEqual(filterByProcessingStatus(articles,'paraphrase').map(a=>a.id),['p1','p2']);
assert.deepEqual(filterByProcessingStatus(articles,'translated').map(a=>a.id),['p1','p3']);
assert.equal(filterByProcessingStatus(articles,'').length,5);

console.log('PASS processing counts use authoritative success statuses');
console.log('PASS processing filters match summary counts');
console.log('PASS fallback/failed/missing metadata are excluded');
console.log('Admin processing regression: 3/3 passed');
