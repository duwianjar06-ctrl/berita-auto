import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const articleUrl=readFileSync(new URL('../lib/article-url.js',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../lib/persistence.js',import.meta.url),'utf8');
const storyCarousel=readFileSync(new URL('../components/StoryCarousel.jsx',import.meta.url),'utf8');
const review=readFileSync(new URL('../lib/instagram-review.js',import.meta.url),'utf8');

for(const forbidden of ['./persistence.js','./instagram-review-repair.js','./social-preparation.js','sharp','node:fs','node:child_process','node:crypto','node:events']){
  assert.equal(articleUrl.includes(forbidden),false,`article-url.js must stay client-safe: ${forbidden}`);
}
assert.match(storyCarousel,/from ['"]\.\.\/lib\/article-url\.js['"]/,'StoryCarousel should use only the pure article URL helper');
assert.equal(storyCarousel.includes("from '../lib/persistence.js'"),false,'StoryCarousel must not import persistence');
assert.equal(persistence.includes('instagram-review-repair'),false,'persistence must not import review repair orchestration');
assert.equal(persistence.includes('social-preparation'),false,'persistence must not import social preparation');
assert.match(review,/export async function listInstagramReviewQueue\(\)/,'Instagram review queue reader must be defined in the review module');
assert.match(review,/repairInstagramReviewQueue\(\{limit:5\}\)/,'review preparation must orchestrate bounded repair after the prepare lock');

console.log('client dependency regression: PASS pure article-url + isolated persistence + server-only Instagram repair boundary');
