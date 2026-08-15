import {getJson,setJson,persistenceConfigured} from './persistence.js';

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
  return String(article?.fingerprint||article?.id||'').trim();
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

export const LEGACY_ID_PATTERN=/^[a-f0-9]{24}$/i;
const LEGACY_INDEX_KEY='ba:news:legacy-map';

export function isLegacyArticlePath(value=''){
  return /^\/?berita\/[a-f0-9]{24}$/i.test(String(value));
}

export function legacyIdFromPath(value=''){
  const match=/^\/?berita\/([a-f0-9]{24})$/i.exec(String(value));
  return match?.[1]?.toLowerCase()||'';
}

function explicitLegacyIds(article={}){
  const values=[article.legacyId,article.oldId,article.oldArticleId,article.legacyArticleId,...(Array.isArray(article.legacyIds)?article.legacyIds:[])];
  return values.map(value=>String(value||'').trim().toLowerCase()).filter(value=>LEGACY_ID_PATTERN.test(value));
}

export function findLegacyArticleInMemory(articles=[],legacyId=''){
  const target=String(legacyId||'').toLowerCase();
  if(!target)return null;
  return articles.find(article=>article?.id?.toLowerCase?.()===target||article?.fingerprint?.toLowerCase?.()===target||explicitLegacyIds(article).includes(target))||null;
}

export async function resolveLegacyArticle(articles=[],legacyId=''){
  const direct=findLegacyArticleInMemory(articles,legacyId);
  if(direct)return{article:direct,source:'authoritative-current'};
  if(!persistenceConfigured())return{article:null,source:'none'};
  const index=await getJson(LEGACY_INDEX_KEY);
  const stableId=String(index?.[String(legacyId).toLowerCase()]||'').trim().toLowerCase();
  if(!stableId)return{article:null,source:'none'};
  const article=articles.find(row=>articleStableId(row).toLowerCase()===stableId||articleStableId(row).toLowerCase().startsWith(stableId.slice(0,8)))||null;
  return{article,source:article?'durable-legacy-index':'stale-index'};
}

export async function backfillLegacyIndex(articles=[]){
  if(!persistenceConfigured())return 0;
  const index=(await getJson(LEGACY_INDEX_KEY))||{};
  let changed=0;
  for(const article of articles){
    const stableId=articleStableId(article);
    if(!stableId)continue;
    for(const legacyId of explicitLegacyIds(article)){
      if(index[legacyId]!==stableId){index[legacyId]=stableId;changed++;}
    }
    if(LEGACY_ID_PATTERN.test(String(article.id||''))&&index[String(article.id).toLowerCase()]!==stableId){index[String(article.id).toLowerCase()]=stableId;changed++;}
  }
  if(changed)await setJson(LEGACY_INDEX_KEY,index);
  return changed;
}
