import assert from 'node:assert/strict';
import {AD_SLOTS,adAspectRatio,safeTargetUrl,validateImageBytes,validateImageFileMeta,normalizeAdPayload,getActiveAd} from '../lib/ads.js';

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);

test('all existing banner placements are represented',()=>assert.deepEqual(Object.keys(AD_SLOTS),['homepage_top','homepage_sidebar','homepage_after_featured','homepage_feed_1','homepage_category_1','homepage_bottom','article','sidebar']));
test('slot aspect ratios are stable',()=>{for(const slot of Object.keys(AD_SLOTS))assert.match(adAspectRatio(slot),/^\d+ \/ \d+$/)});
test('https target is accepted',()=>assert.equal(safeTargetUrl('https://contoh.com/promo'),'https://contoh.com/promo'));
test('internal target is accepted',()=>assert.equal(safeTargetUrl('/promo'),'/promo'));
test('javascript target is rejected',()=>assert.throws(()=>safeTargetUrl('javascript:alert(1)'),/http|https/));
test('data target is rejected',()=>assert.throws(()=>safeTargetUrl('data:text/html,x'),/http|https/));
test('vbscript target is rejected',()=>assert.throws(()=>safeTargetUrl('vbscript:msgbox(1)'),/http|https/));
test('valid jpeg signature is accepted',()=>assert.equal(validateImageBytes(Buffer.from([0xff,0xd8,0xff,0x00]),'image/jpeg'),true));
test('valid png signature is accepted',()=>assert.equal(validateImageBytes(Buffer.from([137,80,78,71,13,10,26,10]),'image/png'),true));
test('valid webp signature is accepted',()=>assert.equal(validateImageBytes(Buffer.from('RIFF0000WEBP'),'image/webp'),true));
test('invalid image bytes are rejected',()=>assert.equal(validateImageBytes(Buffer.from('not-an-image'),'image/png'),false));
test('oversized image metadata is rejected',()=>assert.throws(()=>validateImageFileMeta({type:'image/png',name:'x.png',size:3*1024*1024}),/2 MB/));
test('svg is rejected',()=>assert.throws(()=>validateImageFileMeta({type:'image/svg+xml',name:'x.svg',size:100}),/JPG/));
test('ad payload requires a known slot',()=>assert.throws(()=>normalizeAdPayload({slot:'unknown',imageUrl:'https://example.com/a.png',targetUrl:'https://example.com'}),/Slot iklan/));
test('ad payload keeps an existing image when editing without replacement',()=>{const row=normalizeAdPayload({slot:'homepage_top',imageUrl:'https://cdn.example/a.png',targetUrl:'https://example.com',title:'A'},null);const edited=normalizeAdPayload({slot:'homepage_top',targetUrl:'https://example.com/promo'},row);assert.equal(edited.imageUrl,row.imageUrl);assert.equal(edited.id,row.id)});
test('active ad lookup is safe without configured persistence',async()=>assert.equal(await getActiveAd('homepage_top'),null));

for(const [name,fn] of tests)await fn(),console.log(`PASS ${name}`);
console.log(`Ads regression: ${tests.length}/${tests.length} passed`);
