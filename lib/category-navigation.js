import {categories,categorySlug} from './categories.js';

export function sortCategoriesByPublishedCount(counts={}){
  return categories.map((name,index)=>({
    name,
    count:Number.isFinite(Number(counts[name]))?Number(counts[name]):0,
    index,
  })).sort((a,b)=>b.count-a.count||a.index-b.index||a.name.localeCompare(b.name));
}

export function splitCategoryNavigation(counts={},visibleCount=8){
  const ordered=sortCategoriesByPublishedCount(counts);
  const safeVisibleCount=Math.max(0,Math.min(Number(visibleCount)||0,ordered.length));
  return {ordered,primary:ordered.slice(0,safeVisibleCount),overflow:ordered.slice(safeVisibleCount)};
}

export function categoryRoute(name){
  return `/kategori/${categorySlug(name)}`;
}
