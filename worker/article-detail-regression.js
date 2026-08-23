import assert from 'node:assert/strict';
import {parseMarkdown,normalizeArticleMarkdown,buildArticleHeadings} from '../components/article/ArticleDetailView.jsx';
import {fallbackSvg,buildArticleImagePrompt,wrapTextByWords,titleLines} from '../lib/article-image.js';
import {ARTICLE_CONFIG} from '../lib/article-config.js';
import {entityList,similarity} from '../lib/entity-similarity.js';

const markdown=`## Jawaban Singkat\n\n**Gunakan** prosedur sesuai manual kendaraan.\n\n## Langkah-Langkah\n\n1. Panaskan mesin hingga suhu kerja.\n2. Periksa baut penyetel.\n\n> Perhatian: mesin dapat panas.\n\n### Catatan\n\n- Gunakan area berventilasi.\n- Jangan memaksa baut.\n\n| Item | Nilai |\n| --- | --- |\n| Mesin | Sesuai manual |`;
const legacy='## Jawaban Singkat\\n\\nKampas rem yang harus diganti.\\n\\n## Kesimpulan';
assert.equal(normalizeArticleMarkdown(legacy),'## Jawaban Singkat\n\nKampas rem yang harus diganti.\n\n## Kesimpulan');
const blocks=parseMarkdown(markdown);assert.ok(blocks.some(x=>x.type==='heading'&&x.text==='Jawaban Singkat'));assert.ok(blocks.some(x=>x.type==='ol'&&x.items.length===2));assert.ok(blocks.some(x=>x.type==='callout'));assert.ok(blocks.some(x=>x.type==='ul'));assert.ok(blocks.some(x=>x.type==='table'));
const headings=buildArticleHeadings(blocks);assert.deepEqual(headings.map(x=>x.text),['Jawaban Singkat','Langkah-Langkah','Catatan']);assert.equal(headings.length,3);assert.notEqual(headings[0].id,headings[1].id);
const boldBlocks=parseMarkdown('## T\n\n**Suara decit:**\n\n* item satu');assert.ok(boldBlocks.some(x=>x.type==='ul'&&x.items[0]==='item satu'));
const longTitles=['Panduan Efisiensi Energi: Cara Menghemat Listrik Tanpa Mengurangi Kenyamanan','Perbedaan Motor Injeksi vs Karburator: Mana yang Lebih Baik untuk Anda?','Panduan Memilih Oli Motor yang Tepat untuk Penggunaan Harian','Penyebab Speedometer Motor Mati dan Cara Mengatasinya'];
for(const title of longTitles){const lines=wrapTextByWords(title,{maxWidth:920,maxLines:3,fontSize:46});const original=new Set(title.toLowerCase().split(/\s+/));assert.ok(lines.length<=3);for(const line of lines){for(const word of line.replace(/…$/,'').split(/\s+/)){assert.ok(original.has(word.toLowerCase()),`fragmented word: ${word}`)}}}
const titleResult=titleLines(longTitles[0]);assert.ok(titleResult.lines.some(x=>x.split(/\s+/).includes('Listrik')));assert.ok(!titleResult.lines.some(x=>/^Listr$|^ik$/.test(x)));assert.equal(titleResult.truncated,false);
const fallback=fallbackSvg({title:longTitles[0],category:'Public Utility'},ARTICLE_CONFIG.image);assert.equal(Buffer.isBuffer(fallback),true);assert.ok(fallback.length>100);assert.doesNotMatch(fallback.toString('utf8'),/Menghemat Lis\s*<\/tspan>\s*<tspan[^>]*>trik/i);assert.match(fallback.toString('utf8'),/>Listrik(?: |<\/tspan>)/);
const prompt=buildArticleImagePrompt({title:'Cara Menyetel Karburator Motor',primaryQuery:'cara menyetel karburator motor'});assert.match(prompt,/Berita Auto/);assert.match(prompt,/16:9/);
assert.equal(ARTICLE_CONFIG.image.width,1200);assert.equal(ARTICLE_CONFIG.image.height,675);assert.equal(ARTICLE_CONFIG.image.templateVersion,2);

const arrayEntities={entities:['Bank Indonesia','Bank Kliring Renminbi']};
const objectEntities={entities:{people:['Pieter Huistra'],organizations:['PSS Sleman'],locations:['Indonesia']}};
assert.deepEqual(entityList(arrayEntities.entities),['Bank Indonesia','Bank Kliring Renminbi']);
assert.deepEqual(entityList(objectEntities.entities),['Pieter Huistra','PSS Sleman','Indonesia']);
assert.deepEqual(entityList({groups:[['A',{nested:['B',null]},undefined],{deep:{items:['C']}}]}),['A','B','C']);
assert.deepEqual(entityList(undefined),[]);assert.deepEqual(entityList(null),[]);assert.deepEqual(entityList('Bank Indonesia'),['Bank Indonesia']);
assert.equal(similarity(arrayEntities,{entityNames:['Bank Indonesia']}),12);
assert.equal(similarity(objectEntities,{entities:{organizations:['PSS Sleman'],locations:['Jakarta']}}),12);
assert.doesNotThrow(()=>similarity({entities:objectEntities.entities},{entities:{nested:['PSS Sleman']}}));
assert.doesNotMatch(String(entityList(objectEntities.entities)),/\[object Object\]/);

console.log('article detail regression: PASS normalization + semantic markdown + toc + word wrapping + image fallback + entity similarity normalization');
