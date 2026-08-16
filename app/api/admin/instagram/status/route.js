import {NextResponse} from 'next/server';
import {auth} from '../../../../../auth.js';
import {getAdminInstagramStatus} from '../../../../../lib/admin-instagram.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function authorized(){let session=null;try{session=await auth()}catch{return false}const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);const email=session?.user?.email?.trim().toLowerCase();return Boolean(email&&allowed.includes(email));}
export async function GET(){if(!await authorized())return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});try{return NextResponse.json(await getAdminInstagramStatus(),{status:200,headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Gagal memuat Instagram telemetry.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
