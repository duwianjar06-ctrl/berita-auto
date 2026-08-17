import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {cleanupLegacyInstagramBatch} from '../../../../../lib/instagram-review-cleanup.js';
import {invalidateInstagramAdminSnapshot} from '../../../../../lib/instagram-admin-snapshot.js';
export const dynamic='force-dynamic';export const runtime='nodejs';
async function guard(){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403});return admin;}
export async function POST(request){const admin=await guard();if(admin instanceof NextResponse)return admin;try{const body=await request.json().catch(()=>({}));const cutoverAt=String(body?.cutoverAt||'');const dryRun=body?.dryRun!==false;const result=await cleanupLegacyInstagramBatch({cutoverAt,dryRun,removedBy:admin?.email||admin?.user?.email||'admin-cutover'});if(!dryRun)invalidateInstagramAdminSnapshot();return NextResponse.json(result,{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:String(error?.code||error?.message||error).slice(0,240)},{status:409,headers:{'Cache-Control':'no-store'}})}}
