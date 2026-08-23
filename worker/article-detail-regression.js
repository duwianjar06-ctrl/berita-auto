import assert from 'node:assert/strict';
import {parseMarkdown,normalizeArticleMarkdown,buildArticleHeadings} from '../components/article/ArticleDetailView.jsx';
import {fallbackSvg,buildArticleImagePrompt,wrapTextByWords} from '../lib/article-image.js';
import {ARTICLE_CONFIG} from '../lib/article-config.js';

const markdown=`## Jawaban Singkat\n\n**Gunakan** prosedur sesuai manual kendaraan.\n\n## Langkah-Langkah\n\n1. Panaskan mesin hingga suhu kerja.\n2. Periksa baut penyetel.\n\n> Perhatian: mesin dapat panas.\n\n### Catatan\n\n- Gunakan area berventilasi.\n- Jangan memaksa baut.\n\n| Item | Nilai |\n| --- | --- |\n| Mesin | Sesuai manual |`;
const legacy='## Jawaban Singkat\\n\\nKampas rem yang harus diganti.\\n\\n## Kesimpulan';
assert.equal(normalizeArticleMarkdown(legacy),'## Jawaban Singkat\n\nKampas rem yang harus diganti.\n\n## Kesimpulan');
const blocks=parseMarkdown(markdown);assert.ok(blocks.some(x=>x.type==='heading'&&x.text==='Jawaban Singkat'));assert.ok(blocks.some(x=>x.type==='ol'&&x.items.length===2));assert.ok(blocks.some(x=>x.type==='callout'));assert.ok(blocks.some(x=>x.type==='ul'));assert.ok(blocks.some(x=>x.type==='table'));
const headings=buildArticleHeadings(blocks);assert.deepEqual(headings.map(x=>x.text),['Jawaban Singkat','Langkah-Langkah','Catatan']);assert.equal(headings.length,3);assert.notEqual(headings[0].id,headings[1].id);
const boldBlocks=parseMarkdown('## T\n\n**Suara decit:**\n\n* item satu');assert.ok(boldBlocks.some(x=>x.type==='ul'&&x.items[0]==='item satu'));
const wrapped=wrapTextByWords('cara menghemat listrik rumah tanpa mengurangi kenyamanan',{maxWidth:280,maxLines:3,fontSize:46});assert.ok(wrapped.every(line=>!/(lis|trik)$/.test(line)));assert.ok(wrapped.every(line=>!line.includes('lis')||line.includes('listrik')));
for(const title of ['Perbedaan Motor Injeksi vs Karburator: Mana yang Lebih Baik untuk Anda?','Panduan Memilih Oli Motor yang Tepat untuk Penggunaan Harian','Penyebab Speedometer Motor Mati dan Cara Mengatasinya']){const lines=wrapTextByWords(title,{maxWidth:1040,maxLines:3,fontSize:46});assert.ok(lines.length<=3);assert.ok(lines.every(Boolean))}
const fallback=fallbackSvg({title:'Cara Menghemat Listrik Rumah Tanpa Mengurangi Kenyamanan',category:'Public Utility'},ARTICLE_CONFIG.image);assert.equal(Buffer.isBuffer(fallback),true);assert.ok(fallback.length>100);assert.doesNotMatch(fallback.toString('utf8'),/Menghemat Lis\ntrik|lis\s*<\/tspan>\s*<tspan[^>]*>trik/i);
const prompt=buildArticleImagePrompt({title:'Cara Menyetel Karburator Motor',primaryQuery:'cara menyetel karburator motor'});assert.match(prompt,/Berita Auto/);assert.match(prompt,/16:9/);
assert.equal(ARTICLE_CONFIG.image.width,1200);assert.equal(ARTICLE_CONFIG.image.height,675);assert.equal(ARTICLE_CONFIG.image.fallback,'branded');
console.log('article detail regression: PASS normalization + semantic markdown + toc + word wrapping + image fallback');
