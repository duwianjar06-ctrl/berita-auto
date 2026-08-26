import {requireAdmin} from '../../../../lib/admin-guard.js';
import {auditArticleImageUrls,migrateArticleImageUrls} from '../../../../lib/article-image-migration.js';
import {checkArticleImageStorageHealth} from '../../../../lib/article-image.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const withHealth=(audit,storageHealth)=>({...audit,...audit.totals,totals:audit.totals,storageHealth});

export async function GET(){
  const admin=await requireAdmin();
  if(!admin||admin.forbidden)return Response.json({error:'forbidden'},{status:403});
  const [audit,storageHealth]=await Promise.all([auditArticleImageUrls(),checkArticleImageStorageHealth().catch(()=>({configured:false,healthy:false,status:'unavailable',code:'STORAGE_HEALTH_ERROR'}))]);
  return Response.json(withHealth(audit,storageHealth),{headers:{'cache-control':'no-store'}});
}

export async function POST(request){
  const admin=await requireAdmin();
  if(!admin||admin.forbidden)return Response.json({error:'forbidden'},{status:403});
  const body=await request.json().catch(()=>({}));
  const execute=body?.dryRun===false||String(body?.action||'').toLowerCase()==='execute';
  if(!execute){
    const [audit,storageHealth]=await Promise.all([auditArticleImageUrls(),checkArticleImageStorageHealth().catch(()=>({configured:false,healthy:false,status:'unavailable',code:'STORAGE_HEALTH_ERROR'}))]);
    return Response.json({mode:'dry_run',...withHealth(audit,storageHealth)},{headers:{'cache-control':'no-store'}});
  }
  const storageHealth=await checkArticleImageStorageHealth().catch(()=>({configured:false,healthy:false,status:'unavailable',code:'STORAGE_HEALTH_ERROR'}));
  const result=await migrateArticleImageUrls({dryRun:false});
  return Response.json({...result,storageHealth},{headers:{'cache-control':'no-store'}});
}
