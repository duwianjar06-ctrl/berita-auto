import {NextResponse} from 'next/server';
import {auth} from '../../../../../auth.js';
import {getAdminInstagramStatus} from '../../../../../lib/admin-instagram.js';
import {getInstagramReviewSnapshot} from '../../../../../lib/instagram-review.js';
import {getInstagramPublishQueueSnapshot} from '../../../../../lib/instagram-publish-queue.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function authorized(){let session=null;try{session=await auth()}catch{return false}const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);const email=session?.user?.email?.trim().toLowerCase();return Boolean(email&&allowed.includes(email));}
export async function GET(){if(!await authorized())return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});try{const [status,review,publishQueue]=await Promise.all([getAdminInstagramStatus(),getInstagramReviewSnapshot(),getInstagramPublishQueueSnapshot({now:Date.now()})]);return NextResponse.json({...status,review,publishQueue},{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:'Gagal memuat Instagram telemetry.',detail:String(error?.message||error).slice(0,160)},{status:503,headers:{'Cache-Control':'no-store'}})}}
