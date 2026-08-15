const FOREIGN_PUBLISHERS=new Set(['Deutsche Welle','NASA','NASA JPL','NOAA NHC','U.S. National Science Foundation','U.S. Geological Survey','TechCrunch','The Verge']);
export function isIndexableArticle(article={}){
 const rawStatus=String(article.translationStatus||'').toLowerCase();
 const status=rawStatus||'legacy';
 const language=String(article.language||'id').toLowerCase();
 const sourceLanguage=String(article.sourceLanguage||'').toLowerCase();
 const publisher=String(article.publisher||article.sourceName||'').trim();
 if(status==='pending'||status==='failed'||status==='fallback_original')return false;
 if(language!=='id')return false;
 if(sourceLanguage&&sourceLanguage!=='id'&&status!=='translated')return false;
 if(!rawStatus&&FOREIGN_PUBLISHERS.has(publisher))return false;
 if(article.indexable===false||/^noindex(?:,|\s)/i.test(String(article.robots||'')))return false;
 return true;
}
export {FOREIGN_PUBLISHERS};
