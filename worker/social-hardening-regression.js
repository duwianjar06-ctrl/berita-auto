import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {validateSocialCardBuffer} from '../lib/social-card-validation.js';

const route=readFileSync(new URL('../app/api/social-card/[articleId]/route.jsx',import.meta.url),'utf8');
const socialRun=readFileSync(new URL('./social-run.js',import.meta.url),'utf8');
const repair=readFileSync(new URL('./social-repair.js',import.meta.url),'utf8');

const jpeg=await sharp(randomBytes(1080*1350*3),{raw:{width:1080,height:1350,channels:3}}).jpeg({quality:86}).toBuffer();
const valid=await validateSocialCardBuffer(jpeg,{expectedTextLength:20});
assert.equal(valid.width,1080);assert.equal(valid.height,1350);assert.equal(valid.format,'jpeg');
await assert.rejects(()=>validateSocialCardBuffer(Buffer.alloc(100),{expectedTextLength:20}),/social_card_invalid_size/);
assert.match(route,/X-Social-Card-Render/);assert.match(route,/X-Social-Card-Text-Length/);
assert.match(socialRun,/validateSocialCardUrl/);assert.match(socialRun,/Promise\.all\(urls\.map/);assert.match(socialRun,/urls\.length > 2/);
assert.match(repair,/SOCIAL_REPAIR_CONFIRM/);assert.match(repair,/confirm!==['"]REPAIR['"]/);assert.match(repair,/SOCIAL_REPAIR_OLD_MEDIA_ID/);assert.match(repair,/mode:'repair'/);assert.match(repair,/ba:social:instagram:repair:/);
console.log('social hardening regression: PASS');
