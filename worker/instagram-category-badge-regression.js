import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {socialVisualProfile} from '../lib/social-visual.js';
import {categoryBadgeMetrics,SOCIAL_CARD_DESIGN,SOCIAL_CARD_DESIGN_VERSION,SOCIAL_CARD_COLORS} from '../lib/social-card-renderer.js';
const renderer=await readFile(new URL('../lib/social-card-renderer.js',import.meta.url),'utf8');
const categories=['Ekonomi','Kesehatan','Nasional','Internasional','Hukum','Sains','Teknologi','Bencana & Cuaca'];
for(const category of categories){const theme=socialVisualProfile({category}).style;assert.ok(theme.accent,`${category}: missing accent`);assert.ok(theme.badgeBackground,`${category}: missing badge background`);assert.ok(theme.ctaAccent,`${category}: missing CTA accent`);const metrics=await categoryBadgeMetrics(category);assert.ok(metrics.width>=116&&metrics.width<=330,`${category}: bounded badge width`);assert.equal(metrics.height,SOCIAL_CARD_DESIGN.CATEGORY_HEIGHT);assert.equal(metrics.accent,SOCIAL_CARD_COLORS.warmOrange,`${category}: restrained orange badge`);}
assert.equal(SOCIAL_CARD_DESIGN_VERSION,'classic-dark-editorial-v2');assert.equal(SOCIAL_CARD_DESIGN.CATEGORY_HEIGHT,46);assert.match(renderer,/categoryBadgeMetrics\(category\)/);assert.match(renderer,/catW=await categoryWidth\(category\)/);assert.match(renderer,/catX=W-SR-catW/);assert.match(renderer,/rx=\"23\"/);assert.match(renderer,/text-anchor=\"middle\" dominant-baseline=\"middle\"/);assert.doesNotMatch(renderer,/width:\s*100%/);assert.doesNotMatch(renderer,/flex-grow:\s*1/);assert.doesNotMatch(renderer,/BERITA TERKINI.*categoryPill/);
console.log('Instagram category badge regression: PASS centralized 46px compact orange badge formula, bounded width, top-right placement, centered text, and shared renderer');
