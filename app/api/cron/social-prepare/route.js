import {NextResponse} from 'next/server';
import {prepareInstagramProductionQueue} from '../../../../lib/instagram-preparation-runtime.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function authorized(request){const secret=process.env.CRON_SECRET||'';const auth=request.headers.get('authorization')||'';return Boolean(secret&&auth===`Bearer ${secret}`);}
export async function GET(request){if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});try{const result=await prepareInstagramProductionQueue({trigger:'social-prepare',now:Date.now()});console.log('[instagram-prepare]',JSON.stringify(result));return NextResponse.json(result,{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){console.error('[instagram-prepare] failed',error);return NextResponse.json({status:'failed',error:String(error?.message||error).slice(0,240)},{status:503,headers:{'Cache-Control':'no-store'}})}}
export async function POST(request){return GET(request);}
