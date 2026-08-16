import {readArticles} from './storage.js';
import {listJson,getJson,setJson,upsertIndexed} from './persistence.js';
import {prepareInstagramCandidate} from './social-preparation.js';
import {articlePath,articleStableId} from './article-url.js';
import {deterministicCaption} from './social.js';

const INDEX='ba:social:instagram:review:index';
const KEY=id=>`ba:social:instagram:review:item:${id}`;
const MAX_REPAIRS=5;
const siteUrl=()=>String(process.env.SITE_URL||'https://berita-auto.vercel.app').replace(/\/$/,'');

function classify(result){
  const code=String(result?.articleCheck?.failureCode||'').toUpperCase();
  if(code)return code;
  const reason=String(result?.reason||'').toUpperCase();
  if(reason==='CARD_UPLOAD_FAILED')return'CARD_UPLOAD_FAILED';
  if(reason==='CARD_PUBLIC_CHECK_FAILED'||reason==='CARD_VALIDATION_FAILED')return'CARD_PUBLIC_CHECK_FAILED';
  if(reason==='CAPTION_FAILED')return'CAPTION_FAILED';
  if(reason==='IMAGE_PROVENANCE_INVALID')return'IMAGE_PROVENANCE_INVALID';
  if(result?.image?.status==='FALLBACK_USED')return'SOURCE_IMAGE_MISSING';
  if(reason==='ARTICLE_INVALID')return'UNKNOWN_ARTICLE_INVALID';
  return reason||'UNKNOWN_ARTICLE_INVALID';
}

function human(code){
  const map={
    ARTICLE_NOT_FOUND:'Artikel tidak ditemukan di database Berita Auto.',
    ARTICLE_NOT_PUBLISHED:'Artikel belum berstatus publik.',
    ARTICLE_MISSING_ID:'Artikel tidak memiliki ID stabil.',
    ARTICLE_MISSING_STABLE_ID:'Artikel tidak memiliki stable ID untuk canonical route.',
    ARTICLE_MISSING_TITLE:'Judul artikel tidak tersedia.',
    CANONICAL_URL_MISSING:'Canonical URL tidak dapat dibangun dari route artikel resmi.',
    CANONICAL_URL_BUILD_FAILED:'Canonical URL gagal dibangun dari route artikel resmi.',
    CANONICAL_URL_404:'URL Berita Auto menghasilkan HTTP 404.',
    CANONICAL_URL_5XX:'URL Berita Auto menghasilkan server error.',
    CANONICAL_URL_TIMEOUT:'Validasi URL Berita Auto melewati batas waktu.',
    CANONICAL_URL_UNREACHABLE:'URL canonical tidak dapat diakses saat validasi.',
    CANONICAL_REDIRECT_INVALID:'Canonical URL mengarah ke route internal yang tidak valid.',
    SOURCE_URL_INVALID:'URL sumber artikel tidak valid.',
    SOURCE_URL_FAILED:'URL sumber artikel gagal divalidasi.',
    SOURCE_IMAGE_MISSING:'Foto sumber tidak tersedia; fallback Berita Auto digunakan.',
    CARD_UPLOAD_FAILED:'Card Instagram gagal disimpan.',
    CARD_PUBLIC_CHECK_FAILED:'Card Instagram gagal divalidasi secara publik.',
    CAPTION_FAILED:'Caption gagal disiapkan.',
    IMAGE_PROVENANCE_INVALID:'Asal gambar tidak dapat divalidasi.',
    UNKNOWN_ARTICLE_INVALID:'Validasi artikel gagal dan membutuhkan pemeriksaan lebih lanjut.'
  };
  return map[code]||code;
}

function repairable(row){
  return row&&['FAILED','ATTENTION'].includes(String(row.status||'').toUpperCase())&&!row.removedAt&&!row.postedAt;
}

async function persist(row,patch){
  const updated={...row,...patch,updatedAt:new Date().toISOString()};
  await upsertIndexed(INDEX,KEY(updated.queueId),updated);
  return updated;
}

export async function repairInstagramReviewQueue({limit=MAX_REPAIRS}={}){
  const rows=(await listJson(INDEX)).filter(repairable).slice(0,Math.max(1,Math.min(MAX_REPAIRS,Number(limit)||MAX_REPAIRS)));
  const articles=await readArticles();
  const diagnostics={examined:rows.length,attempted:0,recovered:0,stillInvalid:0,articleNotFound:0,canonical200:0,imageFallback:0,cardFailed:0,captionFailed:0,storageFailed:0};
  const repaired=[];
  for(const row of rows){
    diagnostics.attempted++;
    const article=articles.find(item=>String(item?.id)===String(row.articleId));
    const originalFailure={
      failureCode:row.failureCode||row.attentionReason||row.lastError||'ARTICLE_INVALID',
      failureStage:row.failureStage||null,
      failureMessage:row.failureMessage||row.lastError||null,
      failedAt:row.failedAt||row.updatedAt||null,
      attemptedCanonicalUrl:row.attemptedCanonicalUrl||row.canonicalUrl||null,
      canonicalHttpStatus:row.canonicalHttpStatus||null
    };
    if(!article){
      diagnostics.articleNotFound++;diagnostics.stillInvalid++;
      await persist(row,{status:'FAILED',attentionReason:'ARTICLE_NOT_FOUND',failureCode:'ARTICLE_NOT_FOUND',failureStage:'ARTICLE_LOOKUP',failureMessage:human('ARTICLE_NOT_FOUND'),articleFound:false,articlePublished:false,repairAttempted:true,repairResult:'FAILED',failedAt:new Date().toISOString()});
      continue;
    }
    const stableId=articleStableId(article);
    const canonicalUrl=stableId&&articlePath(article)?`${siteUrl()}${articlePath(article)}`:'';
    let canonicalHttpStatus=null;
    try{
      if(canonicalUrl){
        const response=await fetch(canonicalUrl,{method:'GET',headers:{Accept:'text/html'},cache:'no-store',redirect:'follow'});
        canonicalHttpStatus=response.status;
        if(response.status===200)diagnostics.canonical200++;
      }
    }catch{}
    const result=await prepareInstagramCandidate({article},{siteUrl:siteUrl(),runId:`repair-${Date.now()}-${row.queueId}`,full:true});
    if(result.image?.status==='FALLBACK_USED')diagnostics.imageFallback++;
    const failureCode=classify(result);
    if(result.status==='READY'){
      const history=Array.isArray(row.repairHistory)?row.repairHistory:[];
      const resolvedFailure={...originalFailure,resolvedAt:new Date().toISOString(),repairResult:'SUCCESS',currentCanonicalUrl:canonicalUrl,canonicalHttpStatus:canonicalHttpStatus||200};
      const caption=row.captionEdited?row.caption:deterministicCaption(article,siteUrl());
      const updated=await persist(row,{
        title:article.title,category:article.category,articleId:article.id,stableId:stableId||row.stableId,
        canonicalUrl,attemptedCanonicalUrl:canonicalUrl,canonicalHttpStatus:canonicalHttpStatus||200,
        sourceUrl:article.sourceUrl||article.source||article.originalUrl||row.sourceUrl||null,
        sourceImageUrl:result.image?.imageUrl||null,imageOriginUrl:result.image?.imageOriginUrl||null,
        imageValidation:result.image||null,imageValidationStatus:result.image?.status||'UNKNOWN',
        imageRelationship:result.imageRelationship||result.image?.status||'UNKNOWN',cardUrls:result.cardUrls||[],previewUrl:result.previewUrl||result.cardUrls?.[0]||null,
        cardChecks:result.cardChecks||[],render:result.render||null,font:result.font||null,glyph:result.glyph||null,
        caption,captionOriginal:row.captionOriginal||deterministicCaption(article,siteUrl()),captionEdited:Boolean(row.captionEdited),captionEditedAt:row.captionEditedAt||null,captionStatus:'READY',
        status:'READY',preparationState:'READY',readyAt:result.readyAt||new Date().toISOString(),lastError:null,attentionReason:null,failureCode:null,failureStage:null,failureMessage:null,failedAt:null,repairAttempted:true,repairResult:'SUCCESS',resolvedFailure,
        repairHistory:[...history,resolvedFailure].slice(-10),articleFound:true,articlePublished:Boolean(article.sitePublishedAt),originalFailure:row.originalFailure||originalFailure
      });
      diagnostics.recovered++;repaired.push(updated);
    }else{
      diagnostics.stillInvalid++;
      if(failureCode.startsWith('CARD_'))diagnostics.cardFailed++;
      if(failureCode==='CAPTION_FAILED')diagnostics.captionFailed++;
      const updated=await persist(row,{
        title:article.title,category:article.category,stableId:stableId||row.stableId,canonicalUrl:canonicalUrl||row.canonicalUrl,attemptedCanonicalUrl:result.articleCheck?.canonicalUrl||canonicalUrl||row.attemptedCanonicalUrl||null,
        canonicalHttpStatus:result.articleCheck?.publicStatus==='PASS'?200:(canonicalHttpStatus||null),articleFound:true,articlePublished:Boolean(article.sitePublishedAt),
        status:'FAILED',attentionReason:failureCode,failureCode,failureStage:result.articleCheck?.failureStage||'PREPARATION',failureMessage:human(failureCode),lastError:failureCode,repairAttempted:true,repairResult:'FAILED',failedAt:new Date().toISOString()
      });
      repaired.push(updated);
    }
  }
  const summary={...diagnostics,repairedAt:new Date().toISOString(),items:repaired.map(row=>({queueId:row.queueId,status:row.status,failureCode:row.failureCode||null,repairResult:row.repairResult||null,canonicalUrl:row.canonicalUrl||null}))};
  try{await setJson('ba:social:instagram:review:repair:last-run',summary);}catch{}
  return summary;
}
