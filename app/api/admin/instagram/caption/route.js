import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {getJson,setJson} from '../../../../../lib/persistence.js';
import {readArticles} from '../../../../../lib/storage.js';
import {buildInstagramSeo,validateInstagramCaption} from '../../../../../lib/social.js';
import {invalidateInstagramAdminSnapshot} from '../../../../../lib/instagram-admin-snapshot.js';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const itemKey=id=>`ba:social:instagram:review:item:${id}`;

export async function POST(request){
  const admin=await requireAdmin();
  if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});
  try{
    const body=await request.json();
    const queueId=String(body?.queueId||'');
    if(!queueId)throw new Error('queue_id_required');
    const row=await getJson(itemKey(queueId));
    if(!row)throw new Error('review_item_not_found');
    if(row.captionEdited)throw new Error('manual_caption_protected');
    if(!['READY','FAILED'].includes(String(row.status||'').toUpperCase()))throw new Error('review_item_not_regenerable');
    const article=(await readArticles()).find(item=>String(item.id)===String(row.articleId));
    if(!article)throw new Error('article_not_found');
    const seo=buildInstagramSeo(article,process.env.SITE_URL||'https://berita-auto.vercel.app');
    const validation=validateInstagramCaption(seo.caption,article);
    if(!validation.valid)throw new Error(`caption_validation_failed:${validation.errors.join(',')}`);
    const updated={...row,caption:seo.caption,captionOriginal:seo.caption,captionStatus:'READY',captionLength:seo.captionLength,captionLengthStatus:seo.captionLengthStatus,captionQualityStatus:seo.captionQualityStatus,captionGeneratedBy:seo.captionGeneratedBy,captionGeneratedAt:seo.captionGeneratedAt,captionSourceLength:seo.captionSourceLength,captionSourceHash:seo.captionSourceHash,captionCoverage:seo.captionCoverage,captionValidation:seo.captionValidation,captionSourceField:seo.captionSourceField,captionRegeneratedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastError:null};
    await setJson(itemKey(queueId),updated);
    invalidateInstagramAdminSnapshot();
    return NextResponse.json({status:'regenerated',item:updated},{status:200,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const message=String(error?.message||error).slice(0,240);
    const status=message==='manual_caption_protected'?409:message==='review_item_not_found'||message==='article_not_found'?404:400;
    return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
  }
}
