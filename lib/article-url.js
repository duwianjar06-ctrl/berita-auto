export function slugify(value=''){
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g,' ')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,90)
    .replace(/-+$/,'');
}

export function articleStableId(article={}){
  return String(article?.stableId||article?.fingerprint||article?.id||'').trim();
}

export function stableIdFromArticlePath(value=''){
  const match=/^(.+)-([a-f0-9]{8})$/.exec(String(value).replace(/^\/berita\//,''));
  return match?.[2]||'';
}

export function matchesArticleStableId(article,value=''){
  const short=stableIdFromArticlePath(value);
  return Boolean(short&&articleStableId(article).startsWith(short));
}

export function articleSlug(article){
  const base=article?.slug||slugify(article?.title||'artikel');
  return `${base}-${articleStableId(article).slice(0,8)}`;
}

export function articlePath(article){
  return `/berita/${articleSlug(article)}`;
}

export function isArticleRouteResolvable(article={}){
  const id=articleStableId(article);
  const path=articlePath(article);
  return Boolean(id&&/^[a-f0-9]{8,}$/i.test(id)&&stableIdFromArticlePath(path)===id.slice(0,8).toLowerCase());
}
