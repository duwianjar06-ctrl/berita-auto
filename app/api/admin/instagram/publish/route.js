import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {publishInstagramReviewItem} from '../../../../../lib/instagram-review.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403});try{const body=await request.json();const queueId=String(body?.queueId||'');const idempotencyKey=String(body?.idempotencyKey||`${queueId}:${Date.now()}`);const item=await publishInstagramReviewItem(queueId,{idempotencyKey});return NextResponse.json({status:'published',item},{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){const message=String(error?.message||error).slice(0,240);const status=message==='META_LIMITED'?429:message==='publish_already_in_progress'?409:400;return NextResponse.json({status:'failed',error:message},{status,headers:{'Cache-Control':'no-store'}})}}
