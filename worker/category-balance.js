import {categories} from '../lib/categories.js';
import {isIndexableArticle} from '../lib/article-seo.js';

export const CATEGORY_HEALTH_TARGET=0.02;
export const CATEGORY_RECOVERY_TARGET=0.025;

export function categoryDistribution(published=[]){
  const rows=categories.map(category=>({category,count:0,share:0,deficit:0,status:'EMPTY'}));
  const byCategory=new Map(rows.map(row=>[row.category,row]));
  const eligible=published.filter(isIndexableArticle);
  for(const article of eligible){
    const row=byCategory.get(String(article.category||'Nasional'));
    if(row)row.count++;
  }
  const total=eligible.length;
  for(const row of rows){
    row.share=total?row.count/total:0;
    row.deficit=Math.max(0,CATEGORY_RECOVERY_TARGET-row.share);
    row.status=row.count===0?'EMPTY':row.share<0.01?'HIGH PRIORITY':row.share<0.02?'RECOVERY':'HEALTHY';
  }
  return {total,rows};
}

export function categoryPriority(distribution){
  return distribution.rows
    .filter(row=>row.share<CATEGORY_HEALTH_TARGET)
    .sort((a,b)=>{
      const tier=row=>row.count===0?0:row.share<0.01?1:2;
      return tier(a)-tier(b)||b.deficit-a.deficit||a.category.localeCompare(b.category);
    });
}

export function categorySelectionScore(category,distribution){
  const row=distribution.rows.find(x=>x.category===category);
  if(!row)return 0;
  if(row.share>=CATEGORY_HEALTH_TARGET)return 0;
  return Math.min(180,40+Math.round(row.deficit*4000));
}

export function shouldDeprioritizeNational(distribution){
  const national=distribution.rows.find(x=>x.category==='Nasional');
  return Boolean(national&&national.share>=CATEGORY_HEALTH_TARGET&&categoryPriority(distribution).length);
}
