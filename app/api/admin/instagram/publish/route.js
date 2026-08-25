import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {publishInstagramReviewItem} from '../../../../../lib/instagram-review.js';
import {publishInstagramReviewItemQueued} from '../../../../../lib/instagram-publish-queue.js';
import {invalidateInstagramAdminSnapshot} from '../../../../../lib/instagram-admin-snapshot.js';
import {withPersistenceSource} from '../../../../../lib/persistence.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request){
  const admin=await requireAdmin();
  if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403});
  return withPersistenceSource('admin-publish',async()=>{
    try{
      const body=await request.json();
      const queueId=String(body?.queueId||'');
      if(!queueId)throw new Error('review_item_not_found');
      const idempotencyKey=String(body?.idempotencyKey||`${queueId}:${Date.now()}`);
      const result=await publishInstagramReviewItemQueued(queueId,(id,options={})=>publishInstagramReviewItem(id,{idempotencyKey:options.idempotencyKey||idempotencyKey,publishingUsage:options.publishingUsage||null}),{now:Date.now(),idempotencyKey});
      if(result.status==='queued')return NextResponse.json({status:'queued',reason:result.reason,item:result.item,position:result.position,estimatedResumeAt:result.estimatedResumeAt,metaCalls:result.metaCalls||0,publishingUsage:result.publishingUsage||null},{status:202,headers:{'Cache-Control':'no-store'}});
      if(result.status==='already_posted')return NextResponse.json({status:'already_posted',reason:'article_already_published',item:result.item,metaCalls:0},{status:200,headers:{'Cache-Control':'no-store'}});
      if(result.status==='already_posted_reconciled')return NextResponse.json({status:'already_posted_reconciled',reason:'article_already_published',item:result.item,metaCalls:0},{status:200,headers:{'Cache-Control':'no-store'}});
      if(result.status==='published')return NextResponse.json({status:'published',reason:'new_meta_publish',item:result.item,metaCalls:result.metaCalls||0,publishingUsage:result.publishingUsage||null},{status:200,headers:{'Cache-Control':'no-store'}});
      if(result.status==='failed')return NextResponse.json({status:'failed',reason:result.reason||'publish_failed',item:result.item||null,metaCalls:result.metaCalls||0,publishingUsage:result.publishingUsage||null},{status:200,headers:{'Cache-Control':'no-store'}});
      return NextResponse.json({status:String(result.status||'unknown'),reason:result.reason||null,item:result.item||null,metaCalls:result.metaCalls||0,publishingUsage:result.publishingUsage||null},{status:200,headers:{'Cache-Control':'no-store'}});
    }catch(error){
      const message=String(error?.message||error).slice(0,240);
      const status=message==='publish_already_in_progress'?409:message==='META_LIMITED'?429:400;
      return NextResponse.json({status:'failed',error:message,metaCalls:Number(error?.metaCalls||0),metaCode:Number(error?.metaCode||0)||null,metaSubcode:Number(error?.metaSubcode||0)||null},{status,headers:{'Cache-Control':'no-store'}});
    }finally{invalidateInstagramAdminSnapshot()}
  });
}
