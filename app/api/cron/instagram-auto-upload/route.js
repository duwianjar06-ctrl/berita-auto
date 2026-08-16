import {NextResponse} from 'next/server';
import {runInstagramAutoUpload} from '../../../../lib/instagram-auto-upload.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function authorized(request){const secret=process.env.CRON_SECRET||'';const auth=request.headers.get('authorization')||'';return Boolean(secret&&auth===`Bearer ${secret}`);}
async function execute(){try{return NextResponse.json(await runInstagramAutoUpload({trigger:'cron-instagram-auto-upload',now:Date.now()}),{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({status:'failed',error:String(error?.message||error).slice(0,240),metaCalls:0},{status:503,headers:{'Cache-Control':'no-store'}})}}
export async function GET(request){if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});return execute();}
export async function POST(request){return GET(request);}
