import {NextResponse} from 'next/server';
import {auth} from '../../../../auth.js';
import {getSearchAnalyticsProvider} from '../../../../lib/search-analytics-provider.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const allowed=email=>Boolean(email)&&((process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)).includes(String(email).trim().toLowerCase());
export async function GET(){const session=await auth().catch(()=>null);if(!allowed(session?.user?.email))return NextResponse.json({error:'unauthorized'},{status:401});const provider=getSearchAnalyticsProvider();return NextResponse.json({provider:provider.name,rows:await provider.read()},{headers:{'Cache-Control':'no-store'}})}
export async function POST(request){const session=await auth().catch(()=>null);if(!allowed(session?.user?.email))return NextResponse.json({error:'unauthorized'},{status:401});const provider=getSearchAnalyticsProvider();const text=await request.text();const rows=provider.parseCsv(text,String(request.headers.get('x-source')||'manual_import'));if(!rows.length)return NextResponse.json({error:'CSV tidak memiliki baris yang valid'},{status:400});await provider.save(rows);return NextResponse.json({ok:true,imported:rows.length},{status:201})}
