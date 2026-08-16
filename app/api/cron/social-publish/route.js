import {NextResponse} from 'next/server';
import {runSocialCycle} from '../../../../worker/social-run.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function authorized(request){const secret=process.env.CRON_SECRET||'';const auth=request.headers.get('authorization')||'';return Boolean(secret&&auth===`Bearer ${secret}`);}
function safeError(error){return {name:String(error?.name||'Error').slice(0,80),message:String(error?.message||error).replace(/[\r\n]+/g,' ').slice(0,300),operation:String(error?.instagramOperation||'runSocialCycle').slice(0,80),stage:String(error?.socialStage||'unknown').slice(0,80),status:Number(error?.status||0)||0,metaCode:Number(error?.metaCode||0)||0};}
export async function GET(request){if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});try{return NextResponse.json(await runSocialCycle({trigger:'vercel-cron',now:Date.now()}),{status:200,headers:{'Cache-Control':'no-store'}});}catch(error){const safe=safeError(error);console.error(`[social-cron] failed name=${safe.name} message=${safe.message} operation=${safe.operation} stage=${safe.stage} status=${safe.status} metaCode=${safe.metaCode}`);return NextResponse.json({status:'failed',error:safe.message,stage:safe.stage},{status:503,headers:{'Cache-Control':'no-store'}});}}
export async function POST(request){return GET(request);}
