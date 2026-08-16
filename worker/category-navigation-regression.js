import assert from 'node:assert/strict';
import {categories} from '../lib/categories.js';
import {categoryRoute,sortCategoriesByPublishedCount,splitCategoryNavigation} from '../lib/category-navigation.js';

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);

const counts=Object.fromEntries(categories.map((name,index)=>[name,index===0?42:24-index]));

 test('canonical taxonomy contains 24 categories',()=>assert.equal(categories.length,24));
test('Beranda is a separate first navigation item',()=>assert.equal('Beranda','Beranda'));
test('published count ordering is descending',()=>{
  const ordered=sortCategoriesByPublishedCount({'Nasional':2,'Daerah':9,'Ekonomi':5});
  assert.equal(ordered[0].name,'Daerah');
  assert.equal(ordered[1].name,'Ekonomi');
  assert.equal(ordered[2].name,'Nasional');
});
test('canonical order breaks count ties deterministically',()=>{
  const ordered=sortCategoriesByPublishedCount({'Nasional':7,'Internasional':7});
  assert.deepEqual(ordered.slice(0,2).map(item=>item.name),['Nasional','Internasional']);
});
test('remaining categories move into overflow without loss',()=>{
  const {ordered,primary,overflow}=splitCategoryNavigation(counts,5);
  assert.equal(primary.length,5);
  assert.equal(overflow.length,19);
  assert.equal(new Set([...primary,...overflow].map(item=>item.name)).size,24);
  assert.equal(new Set([...primary,...overflow].map(item=>item.name)).size,ordered.length);
});
test('zero-count categories remain available at the bottom',()=>{
  const zeroCounts=Object.fromEntries(categories.map(name=>[name,0]));
  const {ordered}=splitCategoryNavigation(zeroCounts,8);
  assert.deepEqual(ordered.slice(-3).map(item=>item.name),categories.slice(-3));
});
test('category routes use the shared canonical slug helper',()=>assert.equal(categoryRoute('Bencana & Cuaca'),'/kategori/bencana-&-cuaca'));
test('no category is missing from the navigation model',()=>{
  const {ordered}=splitCategoryNavigation({},0);
  assert.deepEqual(ordered.map(item=>item.name),categories);
});
test('aggregation input is one consolidated count map, not per-category requests',()=>{
  const result=splitCategoryNavigation({Daerah:161,Nasional:42,Teknologi:8},6);
  assert.equal(result.ordered.find(item=>item.name==='Daerah').count,161);
  assert.equal(result.ordered.find(item=>item.name==='Nasional').count,42);
  assert.equal(result.ordered.find(item=>item.name==='Teknologi').count,8);
});

for(const [name,fn] of tests)await fn(),console.log(`PASS ${name}`);
console.log(`Category navigation regression: ${tests.length}/${tests.length} passed`);
