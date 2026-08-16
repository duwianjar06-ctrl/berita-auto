export function hasRealSourceImage(article){
  if(!article)return false;
  if(String(article.imageStatus||'').toLowerCase()==='valid')return true;
  const source=String(article.imageSource||'').toLowerCase();
  if(source&&source!=='default'&&source!=='fallback'&&source!=='generated'&&source!=='site-default')return true;
  return false;
}

export function isFallbackImage(article){
  if(!article)return true;
  if(String(article.imageStatus||'').toLowerCase()==='fallback')return true;
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
