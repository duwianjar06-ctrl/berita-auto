const FOREIGN_PUBLISHERS=new Set(['Deutsche Welle','NASA','NASA JPL','NOAA NHC','U.S. National Science Foundation','U.S. Geological Survey','TechCrunch','The Verge']);
const ID_MARKERS=['yang','dan','untuk','dengan','ini','dari','pada','akan','telah','menjadi','sebut','menurut','dalam','tidak','juga'];
const EN_MARKERS=['the','and','for','with','from','this','that','were','have','has','into','after','before','about','over','under','during','while','where','which','will','their','there','they'];
function countWords(text,words){return words.reduce((n,word)=>n+(new RegExp(`\\b${word}\\b`,'g').test(text)?1:0),0)}
function hasIndonesianSurface(article={}){const text=String(`${article.title||''} ${article.excerpt||''} ${String(article.content||'').slice(0,500)}`).toLowerCase();const idHits=countWords(text,ID_MARKERS);const enHits=countWords(text,EN_MARKERS);return idHits>=2&&!(enHits>=3&&idHits<=2);}
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
