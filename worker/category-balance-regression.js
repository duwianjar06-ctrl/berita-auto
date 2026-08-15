import assert from 'node:assert/strict';
import {selectPublication} from './strategy.js';
import {categoryDistribution,categoryPriority,shouldDeprioritizeNational} from './category-balance.js';
import {categories} from '../lib/categories.js';

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
assert.equal(categoryPriority(distribution)[0].category,'Otomotif');
assert.equal(distribution.rows.find(row=>row.category==='Otomotif').deficitTo2Percent>0,true);
assert.equal(distribution.rows.find(row=>row.category==='Otomotif').recoveryDeficitTo2_5Percent>0,true);
assert.equal(distribution.rows.find(row=>row.category==='Otomotif').priorityRank,1);

const candidates=categoriesUnderTest.map((category,i)=>({fingerprint:`candidate-${i}`,title:`${category} candidate`,summary:'berita yang untuk dengan ini',category,publishedAt:new Date(now-60000).toISOString(),sourceWeight:1,imageUrl:'https://example.com/image.jpg'}));
const first=selectPublication(candidates,published,now);
assert.equal(first.category,'Otomotif');
const after=[first,...published];
const second=selectPublication(candidates.filter(x=>x.fingerprint!==first.fingerprint),after,now);
assert.equal(second.category,'Sains');
assert.equal(first.category,'Otomotif');
assert.equal(second.category,'Sains');
console.log('category balance regression: PASS priority=Otomotif,Sains denominator=875 categories=12 nationalPenalty=active');
