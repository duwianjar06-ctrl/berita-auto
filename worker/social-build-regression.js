import assert from 'node:assert/strict';
import fs from 'node:fs';
const route=fs.readFileSync(new URL('../app/api/social-card/[articleId]/route.jsx',import.meta.url),'utf8');
const prep=fs.readFileSync(new URL('../scripts/prepare-social-fonts.mjs',import.meta.url),'utf8');
const config=fs.readFileSync(new URL('../next.config.mjs',import.meta.url),'utf8');
assert.match(route,/assets[\\\\/]fonts/);assert.match(route,/NotoSans-Regular\.ttf/);assert.match(route,/NotoSans-Bold\.ttf/);assert.doesNotMatch(route,/@fontsource\\/noto-sans/);assert.match(route,/source=bundled-ttf/);
assert.match(prep,/NotoSans-Regular\.ttf/);assert.match(prep,/NotoSans-Bold\.ttf/);assert.match(config,/outputFileTracingIncludes/);assert.match(config,/assets\\/fonts/);
console.log('Social build regression: PASS deterministic bundled TTF font preparation');
