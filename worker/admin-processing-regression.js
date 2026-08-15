import assert from 'node:assert/strict';
import {filterByProcessingStatus,isSuccessfullyParaphrased,isSuccessfullyTranslated,processingCounts,hasPublicationWarning,humanWarnings} from '../lib/admin-processing.js';
const articles=[
 {id:'p1',publishStatus:'published',paraphraseStatus:'success',translationStatus:'translated'},
 {id:'p2',publishStatus:'published',qualityStatus:'warning',publishWarnings:['missing_image'],paraphraseStatus:'success',translationStatus:'fallback'},
 {id:'p3',publishStatus:'published',paraphraseStatus:'fallback',translationStatus:'translated'},
 {id:'p4',publishStatus:'rejected',paraphraseStatus:'failed',translationStatus:'failed',publishWarnings:['invalid_source_url']},
 {id:'p5',publishStatus:'published'}
];
const counts=processingCounts(articles);assert.deepEqual(counts,{paraphrase:2,translation:2,published:4,warning:1,rejected:1});
assert.equal(isSuccessfullyParaphrased(articles[0]),true);assert.equal(isSuccessfullyParaphrased(articles[1]),true);assert.equal(isSuccessfullyParaphrased(articles[2]),false);assert.equal(isSuccessfullyTranslated(articles[0]),true);assert.equal(isSuccessfullyTranslated(articles[1]),false);assert.equal(isSuccessfullyTranslated(articles[2]),true);assert.equal(hasPublicationWarning(articles[1]),true);assert.equal(hasPublicationWarning(articles[4]),false);
assert.deepEqual(filterByProcessingStatus(articles,'paraphrase').map(a=>a.id),['p1','p2']);assert.deepEqual(filterByProcessingStatus(articles,'translated').map(a=>a.id),['p1','p3']);assert.deepEqual(filterByProcessingStatus(articles,'warning').map(a=>a.id),['p2']);assert.deepEqual(filterByProcessingStatus(articles,'rejected').map(a=>a.id),['p4']);assert.equal(filterByProcessingStatus(articles,'').length,5);assert.deepEqual(humanWarnings(articles[1]),['Gambar sumber tidak tersedia.']);
console.log('Admin processing regression: PASS success statuses warning filters rejected filters human-readable warnings');
