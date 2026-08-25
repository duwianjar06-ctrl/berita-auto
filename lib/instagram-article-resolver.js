const CONTENT_FIELDS=['content','body','articleText','cleanedContent','fullText','text','summary','excerpt'];
const META_FIELDS=['id','stableId','fingerprint','slug','title','category','publisher','sourceName','sourceUrl','source','originalUrl','sourceArticleUrl','sourcePublishedAt','publishedAt','sitePublishedAt','canonicalUrl','articleUrl','entities','image','imageUrl','imageOriginUrl','breaking','trending','socialScore'];

function hasValue(value){return value!==undefined&&value!==null&&String(value).trim()!=='';}
function articleId(value){return String(value?.articleId||value?.id||value?.article?.id||'').trim();}

/** Resolve a preparation candidate against the canonical durable article collection.
 * Canonical content fields always win; queue/review metadata is merged only when present.
 */
export function resolveCanonicalInstagramArticle(articleOrItem,canonicalArticles=[]){
  const candidate=articleOrItem?.article&&typeof articleOrItem.article==='object'?articleOrItem.article:articleOrItem||{};
  const id=articleId(articleOrItem)||articleId(candidate);
  const canonical=Array.isArray(canonicalArticles)&&id?canonicalArticles.find(article=>String(article?.id)===id):null;
  if(!canonical)return candidate;
  const merged={...canonical};
  for(const field of META_FIELDS){
    const value=candidate?.[field];
    if(hasValue(value))merged[field]=value;
  }
  for(const field of CONTENT_FIELDS){
    if(hasValue(canonical?.[field]))merged[field]=canonical[field];
    else if(hasValue(candidate?.[field]))merged[field]=candidate[field];
  }
  return merged;
}

export function canonicalInstagramSourceDiagnostics(articleOrItem,canonicalArticles=[]){
  const resolved=resolveCanonicalInstagramArticle(articleOrItem,canonicalArticles);
  const contentField=CONTENT_FIELDS.find(field=>hasValue(resolved?.[field]))||null;
  const source=contentField?String(resolved[contentField]).trim():'';
  return{articleId:articleId(articleOrItem)||String(resolved?.id||''),sourceField:contentField||'title',sourceLength:source.length,hasCanonicalMatch:Boolean(Array.isArray(canonicalArticles)&&canonicalArticles.some(article=>String(article?.id)===String(resolved?.id||'')))};
}
