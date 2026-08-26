import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {auditReadyInstagramUrls,migrateReadyInstagramReviewUrls} from '../../../../../lib/instagram-ready-url-migration.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  const admin=await requireAdmin();
  if(!admin||admin.forbidden)return Response.json({error:'forbidden'},{status:403});
  return Response.json(await auditReadyInstagramUrls(),{headers:{'cache-control':'no-store'}});
}

export async function POST(request){
  const admin=await requireAdmin();
  if(!admin||admin.forbidden)return Response.json({error:'forbidden'},{status:403});
  const body=await request.json().catch(()=>({}));
  const execute=body?.dryRun===false||String(body?.action||'').toLowerCase()==='execute';
  return Response.json(await migrateReadyInstagramReviewUrls({dryRun:!execute}),{headers:{'cache-control':'no-store'}});
}
