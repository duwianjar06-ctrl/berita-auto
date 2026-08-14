import assert from 'node:assert/strict';
import {fetchSource} from '../lib/rss.js';
import {selectIngestionCandidates,selectPublication} from './strategy.js';

const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async()=>new Response(`<?xml version="1.0"?><rss><channel><item><title>Judul Uji</title><link>https://example.com/a</link><description>Ringkasan</description><pubDate>Fri, 14 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>`,{status:200,headers:{'content-type':'application/rss+xml'}});
  const ok=await fetchSource({id:'test',publisher:'Test Publisher',name:'Test Feed',url:'https://example.com/rss',category:'Nasional',weight:1,enabled:true});
  assert.equal(ok.error,null);assert.equal(ok.items.length,1);assert.equal(ok.items[0].publisher,'Test Publisher');assert.equal(ok.items[0].sourceUrl,'https://example.com/rss');
  globalThis.fetch=async()=>new Response('timeout',{status:503});
  const failed=await fetchSource({id:'dead',publisher:'Dead Publisher',name:'Dead Feed',url:'https://example.com/dead',category:'Nasional',weight:1,enabled:true});
  assert.equal(failed.items.length,0);assert.match(failed.error,/HTTP 503/);
  const existing=[{fingerprint:'old-a',titleFingerprint:'title-a',publisher:'ANTARA',sourceName:'ANTARA',category:'Nasional',sitePublishedAt:'2026-08-14T11:00:00.000Z'}];
  const candidates=selectIngestionCandidates([
    {fingerprint:'old-a',titleFingerprint:'title-a',title:'Duplicate',summary:'x',publishedAt:'2026-08-14T12:00:00Z',publisher:'Other',sourceName:'Other',category:'Nasional'},
    {fingerprint:'new-b',titleFingerprint:'title-b',title:'Fresh B',summary:'x',publishedAt:'2026-08-14T12:30:00Z',publisher:'Publisher B',sourceName:'B',category:'Teknologi'},
    {fingerprint:'new-c',titleFingerprint:'title-c',title:'Fresh C',summary:'x',publishedAt:'2026-08-14T12:20:00Z',publisher:'Publisher C',sourceName:'C',category:'Ekonomi'}
  ],new Set(['old-a']),[],existing,Date.parse('2026-08-14T13:00:00Z'));
  assert.equal(candidates.items.length,2);assert(!candidates.items.some(x=>x.fingerprint==='old-a'));
  const history=[{publisher:'ANTARA',sourceName:'ANTARA',category:'Nasional'},{publisher:'ANTARA',sourceName:'ANTARA',category:'Nasional'},{publisher:'ANTARA',sourceName:'ANTARA',category:'Nasional'},{publisher:'B',sourceName:'B',category:'Ekonomi'},{publisher:'C',sourceName:'C',category:'Teknologi'}];
  const chosen=selectPublication([{fingerprint:'a',title:'A',summary:'',publishedAt:'2026-08-14T12:50:00Z',publisher:'ANTARA',sourceName:'ANTARA',category:'Nasional'},{fingerprint:'b',title:'B',summary:'',publishedAt:'2026-08-14T12:45:00Z',publisher:'Publisher B',sourceName:'B',category:'Ekonomi'}],history,Date.parse('2026-08-14T13:00:00Z'));
  assert.equal(chosen.publisher,'Publisher B');
  console.log('source verification: PASS');
}finally{globalThis.fetch=originalFetch;}
