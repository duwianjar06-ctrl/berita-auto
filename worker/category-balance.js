import {categories} from '../lib/categories.js';
import {isIndexableArticle} from '../lib/article-seo.js';

export const CATEGORY_HEALTH_TARGET=0.02;
export const CATEGORY_RECOVERY_TARGET=0.025;

function priorityTier(row){
  if(row.count===0)return 0;
  if(row.share<0.01)return 1;
  if(row.share<CATEGORY_HEALTH_TARGET)return 2;
  return 3;
}

export function categoryPriority(distribution){
  return distribution.rows
    .filter(row=>row.share<CATEGORY_HEALTH_TARGET)
    .sort((a,b)=>priorityTier(a)-priorityTier(b)||b.deficit-a.deficit||a.category.localeCompare(b.category));
}

export function categoryDistribution(published=[]){
  const rows=categories.map(category=>({category,count:0,share:0,deficitTo2Percent:0,recoveryDeficitTo2_5Percent:0,deficit:0,status:'EMPTY',priorityRank:null,priorityTier:3}));
  const byCategory=new Map(rows.map(row=>[row.category,row]));
  const eligible=published.filter(isIndexableArticle);
  for(const article of eligible){
    const row=byCategory.get(String(article.category||'Nasional'));
    if(row)row.count++;
  }
  const total=eligible.length;
  for(const row of rows){
    row.share=total?row.count/total:0;
    row.deficitTo2Percent=Math.max(0,CATEGORY_HEALTH_TARGET-row.share);
    row.recoveryDeficitTo2_5Percent=Math.max(0,CATEGORY_RECOVERY_TARGET-row.share);
    row.deficit=row.recoveryDeficitTo2_5Percent;
    row.status=row.count===0?'EMPTY':row.share<0.01?'HIGH PRIORITY':row.share<CATEGORY_HEALTH_TARGET?'RECOVERY':'HEALTHY';
    row.priorityTier=priorityTier(row);
  }
  const priority=categoryPriority({total,rows});
  priority.forEach((row,index)=>{row.priorityRank=index+1;});
  console.log(`[category-balance] totalIndexable=${total} ${rows.map(row=>`${row.category}=${row.count}(${(row.share*100).toFixed(2)}%) deficit2=${(row.deficitTo2Percent*100).toFixed(2)}% recoveryDeficit=${(row.recoveryDeficitTo2_5Percent*100).toFixed(2)}% rank=${row.priorityRank??'-'}`).join(' | ')} underrepresented=${priority.map(row=>row.category).join(',')||'none'} priority=${priority[0]?.category||'none'}`);
  return {total,rows};
}

export function categorySelectionScore(category,distribution){
  const row=distribution.rows.find(x=>x.category===category);
  if(!row||row.share>=CATEGORY_HEALTH_TARGET)return 0;
  return Math.min(180,40+Math.round(row.recoveryDeficitTo2_5Percent*4000));
}

export function shouldDeprioritizeNational(distribution){
  const national=distribution.rows.find(x=>x.category==='Nasional');
  return Boolean(national&&national.share>=CATEGORY_HEALTH_TARGET&&categoryPriority(distribution).length);
}
