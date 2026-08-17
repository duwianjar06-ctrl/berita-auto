import assert from 'node:assert/strict';
import {renderSocialCard,categoryBadgeMetrics} from '../lib/social-card-renderer.js';
import {socialVisualProfile} from '../lib/social-visual.js';
const categories=['Ekonomi','Kesehatan','Nasional','Internasional','Hukum','Sains','Teknologi','Bencana & Cuaca'];
const article={id:'category-badge-regression',title:'Headline berita untuk pengujian badge kategori',sourceUrl:'',paragraphs:['Fakta pertama untuk memastikan slide cover memiliki struktur yang stabil.','Fakta kedua untuk memastikan semua slide memakai badge yang sama.','Fakta ketiga untuk memastikan slide lanjutan tetap konsisten.']};
for(const category of categories){const theme=socialVisualProfile({category}).style;const metrics=await categoryBadgeMetrics(category,theme);assert.ok(metrics.width>=112,`${category}: badge too small`);assert.ok(metrics.width<500,`${category}: badge too wide (${metrics.width})`);assert.equal(metrics.height,34,`${category}: badge height changed`);for(const slide of [1,2,3]){const rendered=await renderSocialCard({...article,category},slide);assert.equal(rendered.width,1080,`${category} slide ${slide}: width`);assert.equal(rendered.height,1350,`${category} slide ${slide}: height`);}}
console.log('Instagram category badge regression: PASS compact top-right badge metrics and all-slide rendering for 8 production categories');
