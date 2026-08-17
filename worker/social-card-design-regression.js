import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderSocialCard,SOCIAL_CARD_DESIGN,SOCIAL_CARD_DESIGN_VERSION,SOCIAL_CARD_COLORS} from '../lib/social-card-renderer.js';

const base={id:'design-regression',stableId:'design-regression',title:'Berita Auto menguji desain kartu Instagram',category:'Bencana & Cuaca',publisher:'ANTARA',sourceUrl:'not-a-url',sitePublishedAt:'2026-08-17T00:00:00.000Z',summary:'Informasi utama mengenai perkembangan terbaru dan langkah penanganan yang perlu diketahui masyarakat.'};
const long={...base,title:'Gempa NTT, Gus Ipul: Keselamatan dan kebutuhan warga jadi prioritas utama pemerintah dalam penanganan bencana'};
const medium={...base,title:'Pemerintah memastikan keselamatan warga menjadi prioritas'};
const short={...base,title:'Gempa NTT'};

assert.equal(SOCIAL_CARD_DESIGN_VERSION,'classic-dark-editorial-v2');
assert.equal(SOCIAL_CARD_DESIGN.CANVAS_WIDTH,1080);
assert.equal(SOCIAL_CARD_DESIGN.CANVAS_HEIGHT,1350);
assert.equal(SOCIAL_CARD_COLORS.deepNavy,'#06131F');
assert.equal(SOCIAL_CARD_COLORS.warmOrange,'#FF781A');

for(const article of [short,medium,long]){
  for(const slide of [1,2]){
    const rendered=await renderSocialCard(article,slide);
    const meta=await sharp(rendered.buffer).metadata();
    assert.equal(rendered.designVersion,SOCIAL_CARD_DESIGN_VERSION);
    assert.equal(rendered.width,1080);
    assert.equal(rendered.height,1350);
    assert.equal(meta.width,1080);
    assert.equal(meta.height,1350);
    assert.equal(meta.format,'jpeg');
    assert.ok(rendered.buffer.length>10000);
  }
}

const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../lib/social-card-renderer.js',import.meta.url),'utf8'));
for(const forbidden of ['Baca Selengkapnya di','RINGKASAN','timeline','vertical'])assert.equal(source.includes(forbidden),false,`forbidden legacy visual token: ${forbidden}`);
assert.equal(source.includes("#F7F9FC"),true);
assert.equal(source.includes("#06131F"),true);
assert.equal(source.includes('warmGlow'),true);
assert.equal(source.includes('photoOverlay'),true);
console.log('[social-card-design] PASS: 6 renders, 1080x1350 JPEG, classic-dark-editorial-v2, legacy CTA/timeline/cream renderer absent');
