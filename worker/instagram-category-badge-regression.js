import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {socialVisualProfile} from '../lib/social-visual.js';
const renderer=await readFile(new URL('../lib/social-card-renderer.js',import.meta.url),'utf8');
const categories=['Ekonomi','Kesehatan','Nasional','Internasional','Hukum','Sains','Teknologi','Bencana & Cuaca'];
for(const category of categories){const theme=socialVisualProfile({category}).style;assert.ok(theme.accent,`${category}: missing accent`);assert.ok(theme.badgeBackground,`${category}: missing badge background`);assert.ok(theme.ctaAccent,`${category}: missing CTA accent`);}
assert.match(renderer,/export const SOCIAL_CARD_DESIGN/);assert.match(renderer,/CATEGORY_HEIGHT: 34/);assert.match(renderer,/CATEGORY_PADDING_X: 18/);assert.match(renderer,/CATEGORY_GAP: 10/);assert.match(renderer,/categoryBadgeMetrics\(category,theme\)/);assert.match(renderer,/catW=badgeMetrics\.width/);assert.match(renderer,/catX=W-SR-catW/);assert.match(renderer,/width=Math\.min\(MAX,Math\.max\(112/);assert.match(renderer,/text-anchor="middle" dominant-baseline="middle"/);assert.doesNotMatch(renderer,/width:\s*100%/);assert.doesNotMatch(renderer,/flex-grow:\s*1/);assert.doesNotMatch(renderer,/1\s*\/\s*2/);assert.doesNotMatch(renderer,/BERITA TERKINI/);assert.equal((renderer.match(/const header=`/g)||[]).length,1,'category header must have one shared renderer');
console.log('Instagram category badge regression: PASS centralized compact badge formula, top-right placement, centered text, and shared renderer across slides');
