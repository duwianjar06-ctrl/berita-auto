import assert from 'node:assert/strict';
import {selectPublication} from './strategy.js';

const now=Date.parse('2026-08-15T12:00:00Z');
const categories=['Nasional','Ekonomi','Teknologi','Sains','Otomotif'];
const counts={Nasional:700,Ekonomi:150,Teknologi:15,Sains:8,Otomotif:2};
const published=[];
for(const category of categories){for(let i=0;i<counts[category];i++)published.push({id:`${category}-${i}`,fingerprint:`${category}-${i}`,category,language:'id',translationStatus:'translated',indexable:true,robots:'index,follow',title:`${category} ${i} berita yang`,excerpt:'berita yang untuk dengan ini',content:'yang dan untuk dengan ini dari pada akan telah menjadi sebut menurut dalam tidak juga',sitePublishedAt:new Date(now-i*60000).toISOString()});}
const candidates=categories.map((category,i)=>({fingerprint:`candidate-${i}`,title:`${category} candidate`,summary:'berita yang untuk dengan ini',category,publishedAt:new Date(now-60000).toISOString(),sourceWeight:1,imageUrl:'https://example.com/image.jpg'}));
const first=selectPublication(candidates,published,now);
assert.equal(first.category,'Otomotif');
const after=[first,...published];
const second=selectPublication(candidates.filter(x=>x.fingerprint!==first.fingerprint),after,now);
assert.equal(second.category,'Sains');
console.log('category balance regression: PASS',first.category,second.category);
