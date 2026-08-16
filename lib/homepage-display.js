export function hasRealSourceImage(article){
  if(!article)return false;
  const status=String(article.imageStatus||'').toLowerCase();
  if(status==='valid')return true;
  if(['fallback','invalid','broken','missing'].includes(status))return false;
  const source=String(article.imageSource||'').toLowerCase();
  if(!source||['default','fallback','generated','site-default'].includes(source))return false;
  return Boolean(String(article.imageUrl||'').trim());
}

export function isFallbackImage(article){
  if(!article)return true;
  const status=String(article.imageStatus||'').toLowerCase();
  if(status==='fallback')return true;
  if(['default','fallback','generated','site-default'].includes(String(article.imageSource||'').toLowerCase()))return true;
  const warnings=Array.isArray(article.publishWarnings)?article.publishWarnings:[];
  return warnings.some(w=>['missing_image','invalid_image','image_fallback_used'].includes(String(w)));
}

export function eligibleForLatestDisplay(article){
  if(hasRealSourceImage(article))return true;
  if(isFallbackImage(article))return Number(article.totalViews??article.views??0)>=10;
  return false;
}

export function latestDisplayArticles(articles){
  return (Array.isArray(articles)?articles:[])
    .filter(eligibleForLatestDisplay)
    .sort((a,b)=>(Date.parse(b.publishedAt||b.sitePublishedAt||b.sourcePublishedAt||b.createdAt||0)||0)-(Date.parse(a.publishedAt||a.sitePublishedAt||a.sourcePublishedAt||a.createdAt||0)||0));
}
