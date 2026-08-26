import {readArticles,writeArticles} from './storage.js';
import {readArticlesContent,writeArticlesContent} from './article-storage.js';
import {withArticleLock} from './article-storage.js';
import {siteUrl} from './site-url.js';

export const LEGACY_SITE_ORIGIN='https://berita-auto.vercel.app';
const IMAGE_FIELDS=['imageUrl','imageOriginalUrl','imageOriginUrl','fallbackImageUrl','socialImageUrl'];
const BLOB_HOST=/^(?:[^.]+\.)?(?:public\.)?blob\.vercel-storage\.com$/i;
const LEGACY_RE=/^https?:\/\/berita-auto\.vercel\.app(?=\/|$)/i;
const cleanUrl=v=>typeof v==='string'?v.trim():'';
const newOrigin=()=>siteUrl();

function classifyUrl(value){
  const raw=cleanUrl(value);
  if(!raw)return 'MISSING_IMAGE';
  let u;try{u=new URL(raw)}catch{return 'UNKNOWN'}
  if(BLOB_HOST.test(u.hostname))return 'VALID_BLOB';
  if(LEGACY_RE.test(raw))return /^\/api\/(?:article-image-fallback|social-card)\//i.test(u.pathname)?'LEGACY_DYNAMIC_FALLBACK':'LEGACY_SITE_IMAGE';
  if(/^https?:$/i.test(u.protocol))return 'VALID_EXTERNAL_IMAGE';
  return 'UNKNOWN';
}

function replaceLegacy(value){
  if(typeof value!=='string'||!LEGACY_RE.test(value))return value;
  return `${newOrigin()}${value.replace(/^https?:\/\/berita-auto\.vercel\.app/i,'').replace(/^\//,'/')}`;
}

function repairRecord(row){
  if(!row||typeof row!=='object')return {row,changed:false,legacyUrls:0,classes:[]};
  let changed=false,legacyUrls=0;
  const classes=[];
  const next={...row};
  for(const field of IMAGE_FIELDS){
    const value=row[field];
    const values=Array.isArray(value)?value:[value];
    for(const item of values){
      const kind=classifyUrl(item);classes.push(kind);
      if(typeof item==='string'&&LEGACY_RE.test(item)){legacyUrls++;const repaired=replaceLegacy(item);if(repaired!==item){
        if(Array.isArray(value))next[field]=value.map(x=>x===item?repaired:x);else next[field]=repaired;
        changed=true;
      }}
    }
  }
  return {row:next,changed,legacyUrls,classes};
}

function auditRows(rows){
  const stats={scanned:rows.length,legacyUrls:0,validBlob:0,validExternalImage:0,legacyDynamicFallback:0,legacySiteImage:0,missing:0,broken:0,unknown:0,wouldRepair:0,sample:[]};
  for(const row of rows){
    const r=repairRecord(row);stats.legacyUrls+=r.legacyUrls;
    const set=new Set(r.classes);if(set.has('VALID_BLOB'))stats.validBlob++;if(set.has('VALID_EXTERNAL_IMAGE'))stats.validExternalImage++;if(set.has('LEGACY_DYNAMIC_FALLBACK'))stats.legacyDynamicFallback++;if(set.has('LEGACY_SITE_IMAGE'))stats.legacySiteImage++;if(set.has('MISSING_IMAGE'))stats.missing++;if(set.has('UNKNOWN'))stats.unknown++;stats.wouldRepair+=r.changed?1:0;
    if(r.changed&&stats.sample.length<10)stats.sample.push({id:row.id||row.fingerprint||null,fields:IMAGE_FIELDS.filter(f=>typeof row[f]==='string'&&LEGACY_RE.test(row[f]))});
  }
  return stats;
}

export async function auditArticleImageUrls(){
  return withArticleLock(async()=>{
    const [news,content]=await Promise.all([readArticles(),readArticlesContent()]);
    return {siteUrl:newOrigin(),news:auditRows(news),content:auditRows(content),totals:auditRows([...news,...content])};
  });
}

export async function migrateArticleImageUrls({dryRun=true}={}){
  return withArticleLock(async()=>{
    const [news,content]=await Promise.all([readArticles(),readArticlesContent()]);
    const newsAudit=auditRows(news),contentAudit=auditRows(content);
    if(dryRun)return {status:'dry_run',siteUrl:newOrigin(),scanned:news.length+content.length,legacyUrls:newsAudit.legacyUrls+contentAudit.legacyUrls,validBlob:newsAudit.validBlob+contentAudit.validBlob,missing:newsAudit.missing+contentAudit.missing,wouldRepair:newsAudit.wouldRepair+contentAudit.wouldRepair,sample:[...newsAudit.sample,...contentAudit.sample].slice(0,10),news:newsAudit,content:contentAudit};
    const nextNews=news.map(row=>repairRecord(row).row),nextContent=content.map(row=>repairRecord(row).row);
    const newsChanged=news.filter((row,i)=>JSON.stringify(row)!==JSON.stringify(nextNews[i])).length;
    const contentChanged=content.filter((row,i)=>JSON.stringify(row)!==JSON.stringify(nextContent[i])).length;
    if(newsChanged)await writeArticles(nextNews,{previous:news,queueSocial:false});
    if(contentChanged)await writeArticlesContent(nextContent);
    return {status:'completed',siteUrl:newOrigin(),scanned:news.length+content.length,repaired:newsChanged+contentChanged,unchanged:news.length+content.length-newsChanged-contentChanged,failed:0,newsRepaired:newsChanged,contentRepaired:contentChanged};
  });
}

export {classifyUrl};
