import assert from 'node:assert/strict';
import {buildVerifiedExtractiveCaption,validateInstagramCaption} from '../lib/instagram-caption.js';

const base={id:'fact-validation-test',stableId:'fact-validation-test',title:'RAPBN 2027 dibahas pemerintah bersama Siklon Luis',content:'Pemerintah membahas sejumlah kebijakan dalam rapat. Pembahasan tersebut mencakup dampak ekonomi dan langkah lanjutan.',category:'Nasional',publisher:'Sumber Publik',sourceName:'Sumber Publik',sitePublishedAt:new Date().toISOString(),canonicalUrl:'https://berita-auto.vercel.app/berita/fact-validation-test',entities:['Luis']};

const extractive=buildVerifiedExtractiveCaption(base);
const result=validateInstagramCaption(extractive.caption,base);
assert.equal(result.bodyValidation.numbersValid,true,'title year must be trusted by the fact corpus');
assert.equal(result.bodyValidation.entitiesValid,true,'title/entity metadata must be trusted by the fact corpus');
assert.equal(result.structureValidation.urlValid,true,'canonical URL must remain structurally valid');
assert.equal(result.hardValid,true,'verified extractive caption must hard-pass');

const footerOnly=`Pemerintah membahas sejumlah kebijakan dalam rapat.\n\n#BeritaAuto\n\nBaca berita lengkap di Berita Auto:\n${base.canonicalUrl}`;
const footerResult=validateInstagramCaption(footerOnly,base);
assert.equal(footerResult.bodyValidation.numbersValid,true,'footer URL digits must not be fact-checked');
assert.equal(footerResult.bodyValidation.entitiesValid,true,'footer brand must not be fact-checked as article entity');
assert.equal(footerResult.hardValid,true);

const hallucinated=`Pemerintah membahas sejumlah kebijakan dalam rapat dan mengalokasikan Rp999 triliun.\n\n#BeritaAuto\n\nBaca berita lengkap di Berita Auto:\n${base.canonicalUrl}`;
const hallucinatedResult=validateInstagramCaption(hallucinated,base);
assert.equal(hallucinatedResult.hardValid,false,'unsupported factual number must remain hard-invalid');
assert.ok(hallucinatedResult.bodyValidation.unsupportedNumbers.length>0);

console.log('instagram-caption-fact-validation-regression: PASS');
