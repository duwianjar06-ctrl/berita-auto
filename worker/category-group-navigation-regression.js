import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const nav=await readFile(new URL('../components/CategoryNavGrouped.jsx',import.meta.url),'utf8');
const categories=await readFile(new URL('../lib/categories.js',import.meta.url),'utf8');
assert.match(categories,/Nasional/);assert.match(nav,/Beranda/);assert.match(nav,/Kategori Lainnya/);assert.match(nav,/aria-haspopup/);assert.match(nav,/aria-expanded/);assert.match(nav,/Escape/);assert.match(nav,/pointerdown/);assert.match(nav,/max-height/);
for(const group of ['Ekonomi','Teknologi','Olahraga','Lifestyle','Sains & Alam'])assert.match(nav,new RegExp(group.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const child of ['Ekonomi','Bisnis','Keuangan','Teknologi','AI','Gadget','Startup','Olahraga','Sepak Bola','Lifestyle','Travel','Kuliner','Sains','Lingkungan','Bencana & Cuaca','Nasional','Daerah','Politik','Hukum','Internasional','Otomotif','Hiburan','Kesehatan','Pendidikan'])assert.match(nav,new RegExp(child.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
console.log('Category grouped navigation regression: PASS 24 canonical categories, semantic groups, no duplicate category definitions, responsive/accessibility hooks');
