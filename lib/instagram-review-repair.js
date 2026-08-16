import {readArticles} from './storage.js';
import {listJson,getJson,setJson,upsertIndexed} from './persistence.js';
import {prepareInstagramCandidate} from './social-preparation.js';
import {articlePath,articleStableId} from './article-url.js';
import {deterministicCaption} from './social.js';

const INDEX='ba:social:instagram:review:index';
const KEY=id=>`ba:social:instagram:review:item:${id}`;
const MAX_REPAIRS=5;
const RETRY_DELAYS_MINUTES=[5,15,30];
const CANONICAL_TIMEOUT_MS=3000;
const siteUrl=()=>String(process.env.SITE_URL||'https://berita-auto.vercel.app').replace(/\/$/,'');

function classify(result){
  const code=String(result?.articleCheck?.failureCode||'').toUpperCase();
  if(code)return code;
  const reason=String(result?.reason||'').toUpperCase();
  if(reason==='CARD_UPLOAD_FAILED')return'CARD_UPLOAD_FAILED';
  if(result?.cardFailureCode)return String(result.cardFailureCode).toUpperCase();
  if(reason==='CARD_PUBLIC_CHECK_FAILED'||reason==='CARD_VALIDATION_FAILED')return'CARD_PUBLIC_CHECK_FAILED';
  if(reason==='CAPTION_FAILED')return'CAPTION_FAILED';
  if(reason==='IMAGE_PROVENANCE_INVALID')return'IMAGE_PROVENANCE_INVALID';
  if(result?.image?.status==='FALLBACK_USED'&&reason)return'SOURCE_IMAGE_MISSING';
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
    CANONICAL_URL_TIMEOUT:'Pengecekan halaman berita melewati batas waktu.',
    CANONICAL_URL_UNREACHABLE:'URL canonical tidak dapat diakses saat validasi.',
    CANONICAL_REDIRECT_INVALID:'Canonical URL mengarah ke route internal yang tidak valid.',
    SOURCE_URL_INVALID:'URL sumber artikel tidak valid.',
    SOURCE_URL_FAILED:'URL sumber artikel gagal divalidasi.',
    SOURCE_IMAGE_MISSING:'Foto sumber tidak tersedia; fallback Berita Auto digunakan.',
    CARD_UPLOAD_FAILED:'Card Instagram gagal disimpan.',
    CARD_PUBLIC_CHECK_FAILED:'Card Instagram gagal divalidasi secara publik.',
    CARD_PUBLIC_TIMEOUT:'Card sudah dibuat tetapi URL publik belum merespons tepat waktu.',
    CARD_PUBLIC_404:'Card sudah dibuat tetapi URL publik menghasilkan HTTP 404.',
    CARD_PUBLIC_5XX:'Card sudah dibuat tetapi URL publik menghasilkan server error.',
    CARD_PUBLIC_CONTENT_TYPE_INVALID:'URL publik card mengembalikan content type yang tidak valid.',
    CARD_PUBLIC_EMPTY:'URL publik card mengembalikan data kosong.',
    CARD_PUBLIC_DECODE_FAILED:'Card publik gagal didecode atau dimensinya tidak valid.',
    CAPTION_FAILED:'Caption gagal disiapkan.',
    IMAGE_PROVENANCE_INVALID:'Asal gambar tidak dapat divalidasi.',
    UNKNOWN_ARTICLE_INVALID:'Validasi artikel gagal dan membutuhkan pemeriksaan lebih lanjut.'
  };
  return map[code]||code;
}

function repairable(row,now=Date.now()){
  if(!row||!['FAILED','ATTENTION'].includes(String(row.status||'').toUpperCase())||row.removedAt||row.postedAt)return false;
  const next=Date.parse(row.nextRetryAt||'');
  return !Number.isFinite(next)||next<=now;
}

function recoverable(code){return code==='CANONICAL_URL_TIMEOUT'||code==='CANONICAL_URL_UNREACHABLE'||code.startsWith('CARD_PUBLIC_')||code==='CARD_PUBLIC_CHECK_FAILED'||code==='CARD_UPLOAD_FAILED'||code==='STORAGE_FAILED';}
function retryDelayMs(attemptCount){const index=Math.max(0,Math.min(RETRY_DELAYS_MINUTES.length-1,Number(attemptCount||1)-1));return RETRY_DELAYS_MINUTES[index]*60*1000;}

async function persist(row,patch){
  const updated={...row,...patch,updatedAt:new Date().toISOString()};
  await upsertIndexed(INDEX,KEY(updated.queueId),updated);
  return updated;
}

async function fetchCanonicalBounded(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),CANONICAL_TIMEOUT_MS);
  const started=Date.now();
  try{
    const response=await fetch(url,{method:'GET',headers:{Accept:'text/html'},cache:'no-store',redirect:'follow',signal:controller.signal});
    return{status:response.status,durationMs:Date.now()-started,timeout:false};
  }catch(error){
    return{status:null,durationMs:Date.now()-started,timeout:error?.name==='AbortError',error:String(error?.message||error).slice(0,160)};
  }finally{clearTimeout(timer);}
}

export async function repairInstagramReviewQueue({limit=MAX_REPAIRS,now=Date.now()}={}){
  const rows=(await listJson(INDEX)).filter(row=>repairable(row,now)).slice(0,Math.max(1,Math.min(MAX_REPAIRS,Number(limit)||MAX_REPAIRS)));
  const articles=await readArticles();
  const diagnostics={examined:rows.length,attempted:0,recovered:0,stillInvalid:0,articleNotFound:0,canonical200:0,canonicalTimeout:0,canonicalOther:0,canonicalMs:0,imageFallback:0,cardFailed:0,captionFailed:0,storageFailed:0,skippedBackoff:0};
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
      await persist(row,{status:'FAILED',attentionReason:'ARTICLE_NOT_FOUND',failureCode:'ARTICLE_NOT_FOUND',failureStage:'ARTICLE_LOOKUP',failureMessage:human('ARTICLE_NOT_FOUND'),articleFound:false,articlePublished:false,repairAttempted:true,repairResult:'FAILED',failedAt:new Date().toISOString(),nextRetryAt:null});
      continue;
    }
    const stableId=articleStableId(article);
    const canonicalUrl=stableId&&articlePath(article)?`${siteUrl()}${articlePath(article)}`:'';
    let canonicalHttpStatus=null;
    if(canonicalUrl){
      const checked=await fetchCanonicalBounded(canonicalUrl);
      diagnostics.canonicalMs+=checked.durationMs;
      canonicalHttpStatus=checked.status;
      if(checked.status===200)diagnostics.canonical200++;
      else if(checked.timeout)diagnostics.canonicalTimeout++;
      else if(checked.status)diagnostics.canonicalOther++;
    }
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
        repairHistory:[...history,resolvedFailure].slice(-10),articleFound:true,articlePublished:Boolean(article.sitePublishedAt),originalFailure:row.originalFailure||originalFailure,nextRetryAt:null,attemptCount:0
      });
      diagnostics.recovered++;repaired.push(updated);
    }else{
      diagnostics.stillInvalid++;
      if(failureCode.startsWith('CARD_'))diagnostics.cardFailed++;
      if(failureCode==='CAPTION_FAILED')diagnostics.captionFailed++;
      const attemptCount=Number(row.attemptCount||0)+1;
      const nextRetryAt=recoverable(failureCode)?new Date(now+retryDelayMs(attemptCount)).toISOString():null;
      const updated=await persist(row,{
        title:article.title,category:article.category,stableId:stableId||row.stableId,canonicalUrl:canonicalUrl||row.canonicalUrl,attemptedCanonicalUrl:result.articleCheck?.canonicalUrl||canonicalUrl||row.attemptedCanonicalUrl||null,
        canonicalHttpStatus:result.articleCheck?.publicStatus==='PASS'?200:(canonicalHttpStatus||null),articleFound:true,articlePublished:Boolean(article.sitePublishedAt),
        status:'FAILED',attentionReason:failureCode,failureCode,failureStage:result.cardFailureStage||result.articleCheck?.failureStage||'PREPARATION',failureMessage:human(failureCode),lastError:failureCode,repairAttempted:true,repairResult:'FAILED',failedAt:new Date().toISOString(),attemptCount,nextRetryAt
      });
      repaired.push(updated);
    }
  }
  const summary={...diagnostics,repairedAt:new Date().toISOString(),items:repaired.map(row=>({queueId:row.queueId,status:row.status,failureCode:row.failureCode||null,repairResult:row.repairResult||null,canonicalUrl:row.canonicalUrl||null,nextRetryAt:row.nextRetryAt||null}))};
  try{await setJson('ba:social:instagram:review:repair:last-run',summary);}catch{}
  return summary;
}
