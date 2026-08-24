import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {readInstagramPublisherEvents} from '../../../../../lib/instagram-publisher-events.js';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(request){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403});const url=new URL(request.url);const limit=Math.max(1,Math.min(50,Number(url.searchParams.get('limit')||10)||10));try{return NextResponse.json({events:await readInstagramPublisherEvents(limit),refreshedAt:new Date().toISOString()},{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({events:[],error:String(error?.message||error).slice(0,180)},{status:200,headers:{'Cache-Control':'no-store'}})}}
