import assert from 'node:assert/strict';
import {normalizeParaphraseStatus,isParaphraseSuccess} from '../lib/paraphrase-status.js';
import {mergeDurableArticles} from '../lib/storage.js';

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);

test('successful paraphrase is authoritative',()=>assert.equal(normalizeParaphraseStatus({generationProvider:'gemini'}).paraphraseStatus,'success'));
test('fallback is not paraphrase success',()=>assert.equal(normalizeParaphraseStatus({generationProvider:'fallback'}).paraphraseStatus,undefined));
test('explicit failed status is preserved',()=>assert.equal(normalizeParaphraseStatus({generationProvider:'gemini',paraphraseStatus:'failed'}).paraphraseStatus,'failed'));
test('explicit success is preserved',()=>assert.equal(normalizeParaphraseStatus({generationProvider:'gemini',paraphraseStatus:'success'}).paraphraseStatus,'success'));
test('429/error without generation provider is not success',()=>assert.equal(normalizeParaphraseStatus({aiError:'gemini_http_429'}).paraphraseStatus,undefined));
test('old article without metadata is not success',()=>assert.equal(isParaphraseSuccess({title:'old article'}),false));
test('fallback is not success',()=>assert.equal(isParaphraseSuccess({paraphraseStatus:'fallback',generationProvider:'fallback'}),false));
test('failed is not success',()=>assert.equal(isParaphraseSuccess({paraphraseStatus:'failed',generationProvider:'gemini'}),false));
test('success survives normalization',()=>assert.equal(isParaphraseSuccess(normalizeParaphraseStatus({generationProvider:'gemini'})),true));
test('durable article merge preserves paraphrase metadata',()=>{const merged=mergeDurableArticles([{id:'a',title:'A',paraphraseStatus:'success'}],[{id:'a',title:'A updated'}]);assert.equal(merged[0].paraphraseStatus,'success')});
test('durable merge does not invent success for fallback',()=>{const merged=mergeDurableArticles([],[{id:'b',title:'B',generationProvider:'fallback'}]);assert.equal(merged[0].paraphraseStatus,'fallback');assert.equal(isParaphraseSuccess(merged[0]),false)});

for(const [name,fn] of tests)await fn(),console.log(`PASS ${name}`);
console.log(`Paraphrase regression: ${tests.length}/${tests.length} passed`);
