import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {editInstagramReviewCaption,getInstagramReviewSnapshot,removeInstagramReviewItem} from '../../../../../lib/instagram-review.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function guard(){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});return null;}
export async function GET(){const denied=await guard();if(denied)return denied;return NextResponse.json(await getInstagramReviewSnapshot(),{status:200,headers:{'Cache-Control':'no-store'}});}
export async function PATCH(request){const denied=await guard();if(denied)return denied;try{const body=await request.json();const row=await editInstagramReviewCaption(String(body?.queueId||''),body?.caption);return NextResponse.json({status:'updated',item:row},{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:String(error?.message||error).slice(0,240)},{status:400,headers:{'Cache-Control':'no-store'}})}}
export async function DELETE(request){const denied=await guard();if(denied)return denied;try{const body=await request.json();const row=await removeInstagramReviewItem(String(body?.queueId||''));return NextResponse.json({status:'removed',item:row},{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:String(error?.message||error).slice(0,240)},{status:400,headers:{'Cache-Control':'no-store'}})}}
