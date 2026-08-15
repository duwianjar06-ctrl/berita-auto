import assert from 'node:assert/strict';
import {selectPublication} from './strategy.js';
import {categoryDistribution,shouldDeprioritizeNational} from './category-balance.js';
import {categories} from '../lib/categories.js';
import {classifyCategory} from './category.js';
import {isValidImageUrl} from './image-enrichment.js';

const now=Date.parse('2026-08-15T12:00:00Z');
const categoriesUnderTest=['Nasional','Ekonomi','Teknologi','Sains','Otomotif'];
const counts={Nasional:700,Ekonomi:150,Teknologi:15,Sains:8,Otomotif:2};
const published=[];
for(const category of categoriesUnderTest){
  for(let i=0;i<counts[category];i++)published.push({id:`${category}-${i}`,fingerprint:`${category}-${i}`,category,language:'id',translationStatus:'translated',indexable:true,robots:'index,follow',title:`${category} ${i} berita yang`,excerpt:'berita yang untuk dengan ini',content:'yang dan untuk dengan ini dari pada akan telah menjadi sebut menurut dalam tidak juga',sitePublishedAt:new Date(now-i*60000).toISOString()});
}
published.push({id:'pending-excluded',fingerprint:'pending-excluded',category:'Otomotif',language:'id',translationStatus:'pending',indexable:false,robots:'noindex,follow',title:'pending',content:'pending'});
published.push({id:'noindex-excluded',fingerprint:'noindex-excluded',category:'Teknologi',language:'id',translationStatus:'translated',indexable:false,robots:'noindex,follow',title:'noindex',content:'noindex'});

const distribution=categoryDistribution(published);
assert.equal(distribution.total,875,'denominator must exclude pending/non-indexable rows');
assert.equal(distribution.rows.length,categories.length,'all 12 categories must be represented');
assert.equal(distribution.rows.find(row=>row.category==='Otomotif').count,2);
assert.equal(distribution.rows.find(row=>row.category==='Teknologi').count,15);
assert.equal(shouldDeprioritizeNational(distribution),true);
assert.equal(distribution.rows.find(row=>row.category==='Otomotif').deficitTo2Percent>0,true);
assert.equal(distribution.rows.find(row=>row.category==='Otomotif').recoveryDeficitTo2_5Percent>0,true);
assert.equal(distribution.rows.find(row=>row.category==='Otomotif').priorityRank>0,true);

const candidates=categoriesUnderTest.map((category,i)=>({fingerprint:`candidate-${i}`,title:`${category} candidate`,summary:'berita yang untuk dengan ini',category,publishedAt:new Date(now-60000).toISOString(),sourceWeight:1,imageUrl:'https://example.com/image.jpg'}));
const first=selectPublication(candidates,published,now);
assert.equal(first.category,'Otomotif','selection must rank only available valid candidates, not unrelated empty categories');
const after=[first,...published];
const second=selectPublication(candidates.filter(x=>x.fingerprint!==first.fingerprint),after,now);
assert.equal(second.category,'Sains','second slot should move to next available deficit category');
const repeated=[...candidates,{fingerprint:'candidate-oto-2',title:'Otomotif candidate 2',summary:'mobil motor kendaraan',category:'Otomotif',publishedAt:new Date(now-60000).toISOString(),sourceWeight:1,imageUrl:'https://example.com/image.jpg'}];
const reservedSecond=selectPublication(repeated,published,now,['Otomotif']);
assert.equal(reservedSecond.category,'Sains','reserved first deficit category must yield the next deficit category for slot two');

assert.equal(classifyCategory({title:'Perusahaan startup merilis aplikasi software baru untuk smartphone',summary:'platform teknologi dan cyber security'}),'Teknologi');
assert.equal(classifyCategory({title:'Riset astronomi menemukan objek baru',summary:'penelitian ilmiah tentang biologi'}),'Sains');
assert.equal(classifyCategory({title:'Mobil listrik baru diluncurkan',summary:'kendaraan EV untuk pasar Indonesia'}),'Otomotif');
assert.equal(classifyCategory({title:'Film terbaru dibintangi aktor ternama',summary:'konser musik dan penyanyi'}),'Hiburan');
assert.equal(classifyCategory({title:'DPR membahas rancangan undang-undang',summary:'partai politik dan pemilu'}),'Politik');
assert.equal(isValidImageUrl('not-a-url'),false,'invalid image must fail image gate');

console.log('category balance regression: PASS priority=Otomotif,Sains denominator=875 categories=12 nationalPenalty=active truthful-classification=image-gate');