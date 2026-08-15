const FOREIGN_PUBLISHERS=new Set(['Deutsche Welle','NASA','NASA JPL','NOAA NHC','U.S. National Science Foundation','U.S. Geological Survey','TechCrunch','The Verge']);
export function isIndexableArticle(article={}){
 const status=String(article.translationStatus||'translated').toLowerCase();
 const language=String(article.language||'id').toLowerCase();
 const sourceLanguage=String(article.sourceLanguage||'').toLowerCase();
 const publisher=String(article.publisher||article.sourceName||'').trim();
 if(status==='pending'||status==='failed'||status==='fallback_original')return false;
 if(language!=='id')return false;
 if(sourceLanguage&&sourceLanguage!=='id')return false;
 if(FOREIGN_PUBLISHERS.has(publisher))return false;
 if(article.indexable===false||article.robots==='noindex,follow'||article.robots==='noindex')return false;
 return true;
}
export {FOREIGN_PUBLISHERS};
