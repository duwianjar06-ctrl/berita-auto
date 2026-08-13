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

export function articleSlug(article){
  const base=article?.slug||slugify(article?.title||'artikel');
  return `${base}-${String(article?.fingerprint||article?.id||'').slice(0,8)}`;
}

export function articlePath(article){
  return `/berita/${articleSlug(article)}`;
}
