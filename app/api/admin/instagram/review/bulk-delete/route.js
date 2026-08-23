import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../../lib/admin-guard.js';
import {createInstagramBulkDeleteJob} from '../../../../../../lib/instagram-bulk-delete.js';
export const dynamic='force-dynamic';export const runtime='nodejs';
async function guard(){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403});return admin;}
export async function POST(){const admin=await guard();if(admin instanceof NextResponse)return admin;try{const job=await createInstagramBulkDeleteJob({adminEmail:admin?.email||admin?.user?.email||null});return NextResponse.json({jobId:job.jobId,status:job.status,total:job.total,deleted:0,failed:0,skipped:0,remaining:job.total},{status:202,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:String(error?.message||'bulk_delete_create_failed').slice(0,240)},{status:409,headers:{'Cache-Control':'no-store'}})}}
