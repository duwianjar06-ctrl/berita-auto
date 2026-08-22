import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../components/StoryCarousel.jsx',import.meta.url),'utf8');

const autoplay=source.match(/const AUTO_ADVANCE_MS\s*=\s*(\d+)\s*;/)?.[1];
const transition=source.match(/const TRANSITION_MS\s*=\s*(\d+)\s*;/)?.[1];
assert.equal(autoplay,'1000','Sorotan autoplay must be 1000ms (2x the previous 500ms interval)');
assert.equal(transition,'320','Transition duration should remain smooth and separate from autoplay');
assert.match(source,/window\.setTimeout\(\(\)=>\{[\s\S]*?setIndex\(value=>value\+1\);[\s\S]*?\},AUTO_ADVANCE_MS\)/,'Autoplay must use the slowed interval');
assert.match(source,/window\.clearTimeout\(timer\)/,'Autoplay timer must be cleaned up');
assert.match(source,/window\.clearTimeout\(advance\.resumeTimer\)/,'Manual-navigation resume timer must be cleaned up before replacement');
assert.match(source,/onClick=\{\(\)=>advance\(-1\)\}/,'Previous arrow must call manual advance directly');
assert.match(source,/onClick=\{\(\)=>advance\(1\)\}/,'Next arrow must call manual advance directly');
assert.match(source,/togglePaused/,'Play/pause control must remain available');
assert.match(source,/onTouchStart[\s\S]*onTouchEnd/,'Touch/swipe handlers must remain intact');
assert.match(source,/prefers-reduced-motion: reduce/,'Reduced-motion handling must remain intact');
assert.match(source,/items\.concat\(items,items\)/,'Infinite-loop clone items must remain intact');
assert.match(source,/tabIndex=\{slideIndex>=count&&slideIndex<count\*2\?0:-1\}/,'Only the real middle loop should be keyboard-focusable');
console.log('Story carousel regression: PASS');
console.log('Autoplay: 500ms -> 1000ms; velocity = 50% of previous.');
console.log('Transition: 320ms unchanged.');
console.log('Manual arrows, play/pause, touch, cleanup, reduced motion and loop clones preserved.');
