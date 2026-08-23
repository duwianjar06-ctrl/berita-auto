import assert from 'node:assert/strict';
import {parseMarkdown} from '../components/article/ArticleDetailView.jsx';
import {fallbackSvg,buildArticleImagePrompt} from '../lib/article-image.js';
import {ARTICLE_CONFIG} from '../lib/article-config.js';

const markdown=`## Jawaban Singkat\n\n**Gunakan** prosedur sesuai manual kendaraan.\n\n## Langkah-Langkah\n\n1. Panaskan mesin hingga suhu kerja.\n2. Periksa baut penyetel.\n\n> Perhatian: mesin dapat panas.\n\n### Catatan\n\n- Gunakan area berventilasi.\n- Jangan memaksa baut.\n\n| Item | Nilai |\n| --- | --- |\n| Mesin | Sesuai manual |`;
const blocks=parseMarkdown(markdown);assert.ok(blocks.some(x=>x.type==='heading'&&x.text==='Jawaban Singkat'));assert.ok(blocks.some(x=>x.type==='ol'&&x.items.length===2));assert.ok(blocks.some(x=>x.type==='quote'));assert.ok(blocks.some(x=>x.type==='ul'));assert.ok(blocks.some(x=>x.type==='table'));
const fallback=fallbackSvg({title:'Cara Menyetel Karburator Motor',category:'Automotive'},ARTICLE_CONFIG.image);assert.equal(Buffer.isBuffer(fallback),true);assert.ok(fallback.length>100);
const prompt=buildArticleImagePrompt({title:'Cara Menyetel Karburator Motor',primaryQuery:'cara menyetel karburator motor'});assert.match(prompt,/Berita Auto/);assert.match(prompt,/16:9/);
assert.equal(ARTICLE_CONFIG.image.width,1200);assert.equal(ARTICLE_CONFIG.image.height,675);assert.equal(ARTICLE_CONFIG.image.fallback,'branded');
console.log('article detail regression: PASS markdown + steps + table + callout + image fallback');
