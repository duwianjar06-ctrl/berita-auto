import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {prepareInstagramProductionQueue} from '../../../../../lib/instagram-preparation-runtime.js';
import {getJson} from '../../../../../lib/persistence.js';
import {readSocialRuns} from '../../../../../lib/social-telemetry.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const ACTIVE='ba:social:instagram:prepare:active';
const LAST_RUN='ba:social:instagram:prepare:last-run';
async function guard(){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});if(admin.forbidden)return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});return admin;}
function isPreparationRun(row){return ['admin-manual','social-prepare','qstash','scheduled'].includes(String(row?.triggerSource||''));}
async function state(){const [active,lastRun,runs]=await Promise.all([getJson(ACTIVE),getJson(LAST_RUN),readSocialRuns(30)]);const logs=runs.filter(isPreparationRun).slice(0,10).map(run=>({runId:run.runId,trigger:run.triggerSource,status:run.status,stage:run.stage,reason:run.reason||null,durationMs:Number(run.durationMs||0),diagnostics:run.preparationDiagnostics||null,finishedAt:run.finishedAt}));return{active:active&&Number(active.expiresAt||0)>Date.now()?active:null,lastRun,logs};}
export async function GET(){const denied=await guard();if(denied instanceof NextResponse)return denied;try{return NextResponse.json(await state(),{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:'Gagal memuat preparation state.',detail:String(error?.message||error).slice(0,160)},{status:503,headers:{'Cache-Control':'no-store'}})}}
export async function POST(request){const denied=await guard();if(denied instanceof NextResponse)return denied;try{const result=await prepareInstagramProductionQueue({trigger:'admin-manual',now:Date.now()});return NextResponse.json(result,{status:200,headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({status:'failed',error:String(error?.message||error).slice(0,240),metaCalls:0},{status:503,headers:{'Cache-Control':'no-store'}})}}
