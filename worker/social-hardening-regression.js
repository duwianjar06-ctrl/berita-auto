import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {validateSocialCardBuffer} from '../lib/social-card-validation.js';
import {sanitizeCardText} from '../lib/social-visual.js';
import {socialConfig} from '../lib/social.js';

const route=readFileSync(new URL('../app/api/social-card/[articleId]/route.jsx',import.meta.url),'utf8');
const socialRun=readFileSync(new URL('./social-run.js',import.meta.url),'utf8');
const repair=readFileSync(new URL('./social-repair.js',import.meta.url),'utf8');
const fontPrep=readFileSync(new URL('../scripts/prepare-social-fonts.mjs',import.meta.url),'utf8');
const nextConfig=readFileSync(new URL('../next.config.mjs',import.meta.url),'utf8');

const jpeg=await sharp(randomBytes(1080*1350*3),{raw:{width:1080,height:1350,channels:3}}).jpeg({quality:86}).toBuffer();
const valid=await validateSocialCardBuffer(jpeg,{expectedTextLength:20});
assert.equal(valid.width,1080);assert.equal(valid.height,1350);assert.equal(valid.format,'jpeg');
await assert.rejects(()=>validateSocialCardBuffer(Buffer.alloc(100),{expectedTextLength:20}),/social_card_invalid_size/);
assert.match(route,/path\.join\(process\.cwd\(\),'assets','fonts'\)/);assert.match(route,/NotoSans-Regular\.ttf/);assert.match(route,/NotoSans-Bold\.ttf/);assert.match(route,/social_card_bundled_font_missing/);assert.match(route,/process\.env\.FONTCONFIG_FILE=runtimeFontconfig/);assert.match(route,/process\.env\.FONTCONFIG_PATH=fontconfigDir/);assert.match(route,/const \{default:sharp\}=await import\('sharp'\)/);assert.doesNotMatch(route,/@fontsource\/noto-sans/);assert.match(route,/source=bundled-ttf/);
assert.match(fontPrep,/notofonts\/noto-fonts\/ffebf8c1ee449e544955a7e813c54f9b73848eac/);assert.match(fontPrep,/NotoSans-Regular\.ttf/);assert.match(fontPrep,/NotoSans-Bold\.ttf/);assert.match(nextConfig,/outputFileTracingIncludes/);assert.match(nextConfig,/assets\/fonts/);
const sanitized=sanitizeCardText('“Pemerintah Indonesia” — Harga BBM naik… 👮‍♂️\u200B Rp1.500.000 1234567890');assert.equal(sanitized,'"Pemerintah Indonesia" - Harga BBM naik... Rp1.500.000 1234567890');assert.equal(/\p{Extended_Pictographic}/u.test(sanitized),false);assert.equal(sanitized.includes('\u200B'),false);
process.env.INSTAGRAM_MIN_INTERVAL_MINUTES='3';process.env.INSTAGRAM_MAX_POSTS_PER_DAY='50';process.env.INSTAGRAM_PUBLISHING_LIMIT_BUFFER='10';assert.equal(socialConfig().minIntervalMinutes,3);
assert.match(socialRun,/reason.*cooldown/);assert.doesNotMatch(socialRun,/articles\.slice\(0, 100\)/);assert.match(socialRun,/readSocialQueue\(100\)/);assert.match(socialRun,/slice\(0, 20\)/);assert.match(socialRun,/Promise\.all\(urls\.map/);assert.match(socialRun,/reason.*already_published/);assert.match(socialRun,/reason.*lock_busy/);
assert.match(repair,/SOCIAL_REPAIR_CONFIRM/);assert.match(repair,/SOCIAL_REPAIR_OLD_MEDIA_ID/);assert.match(repair,/mode:'repair'/);
console.log('social hardening regression: PASS');
