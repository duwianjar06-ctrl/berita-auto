const FOREIGN_PUBLISHERS=new Set(['Deutsche Welle','NASA','NASA JPL','NOAA NHC','U.S. National Science Foundation','U.S. Geological Survey','TechCrunch','The Verge']);
const ID_MARKERS=['yang','dan','untuk','dengan','ini','dari','pada','akan','telah','menjadi','sebut','menurut','dalam','tidak','juga'];
function hasIndonesianSurface(article={}){const text=String(`${article.title||''} ${article.excerpt||''} ${article.content||''}`).toLowerCase();const hits=ID_MARKERS.reduce((n,word)=>n+(new RegExp(`\\b${word}\\b`,'g').test(text)?1:0),0);return hits>=2;}
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
 if(!hasIndonesianSurface(article))return false;
 return true;
}
export {FOREIGN_PUBLISHERS,hasIndonesianSurface};
