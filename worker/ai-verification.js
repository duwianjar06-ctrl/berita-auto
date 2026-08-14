import assert from 'node:assert/strict';
import {generateArticle} from '../lib/ai.js';

const originalFetch=globalThis.fetch;
const originalKey=process.env.GEMINI_API_KEY;
const originalModel=process.env.GEMINI_MODEL;
try{
  process.env.GEMINI_API_KEY='test-only';
  process.env.GEMINI_MODEL='gemini-2.5-flash-lite';
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({title:'Judul Uji',excerpt:'Ringkasan uji yang cukup panjang untuk lolos validasi.',content:'Paragraf pertama berisi fakta yang tersedia pada bahan uji dan menjelaskan peristiwa secara ringkas.\n\nParagraf kedua tetap mempertahankan fakta material tanpa menambah informasi baru.\n\nParagraf ketiga menyusun ulang bahan sumber dalam Bahasa Indonesia yang natural.',language:'id'})}]}}]}),{status:200,headers:{'content-type':'application/json'}})};
  const item={fingerprint:'ai-test-1',title:'Test',summary:'Ringkasan sumber yang cukup panjang untuk pengujian.',sourceName:'Test Source',sourceUrl:'https://example.com/feed',url:'https://example.com/article',language:'en'};
  const result=await generateArticle(item,'Fakta sumber cukup panjang untuk pengujian artikel. Fakta pertama menjelaskan peristiwa. Fakta kedua menjelaskan dampak yang dilaporkan. Fakta ketiga menjelaskan waktu dan lokasi yang tersedia.');
  assert.equal(result.generationProvider,'gemini');
  assert.equal(result.language,'id');
  assert.equal(calls,1);
  console.log('gemini verification: PASS');
}finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;
  if(originalModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=originalModel;
}
