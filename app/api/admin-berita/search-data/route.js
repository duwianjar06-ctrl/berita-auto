import {NextResponse} from 'next/server';
import {auth} from '../../../../auth.js';
import {parseSearchConsoleCsv,saveSearchAnalytics,readSearchAnalytics} from '../../../../lib/search-data.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function allowed(email){return Boolean(email)&&((process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)).includes(String(email).trim().toLowerCase())}
export async function GET(){const session=await auth().catch(()=>null);if(!allowed(session?.user?.email))return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.json({rows:await readSearchAnalytics()},{headers:{'Cache-Control':'no-store'}})}
export async function POST(request){const session=await auth().catch(()=>null);if(!allowed(session?.user?.email))return NextResponse.json({error:'unauthorized'},{status:401});const text=await request.text();const rows=parseSearchConsoleCsv(text,String(request.headers.get('x-source')||'manual_import'));if(!rows.length)return NextResponse.json({error:'CSV tidak memiliki baris yang valid'},{status:400});await saveSearchAnalytics(rows);return NextResponse.json({ok:true,imported:rows.length},{status:201})}
