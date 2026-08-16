import {NextResponse} from 'next/server';
import {runInstagramAutoUpload} from '../../../../lib/instagram-auto-upload.js';
import {getInstagramAutomationSettings} from '../../../../lib/instagram-automation.js';
import {recordSocialRun} from '../../../../lib/social-telemetry.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function authorized(request){const secret=process.env.CRON_SECRET||'';const auth=request.headers.get('authorization')||'';return Boolean(secret&&auth===`Bearer ${secret}`);}
async function execute(){const startedAt=new Date().toISOString();try{const settings=await getInstagramAutomationSettings();if(!settings.autoUploadEnabled){const result={status:'skipped',reason:'auto_upload_off',metaCalls:0};await recordSocialRun({triggerSource:'social-publish-auto-upload',startedAt,finishedAt:new Date().toISOString(),result}).catch(()=>{});return NextResponse.json({...result,mode:'auto',autoUploadEnabled:false},{status:200,headers:{'Cache-Control':'no-store'}});}const result=await runInstagramAutoUpload({trigger:'social-publish',now:Date.now()});await recordSocialRun({triggerSource:'social-publish-auto-upload',startedAt,finishedAt:new Date().toISOString(),result}).catch(()=>{});return NextResponse.json({...result,mode:'auto',autoUploadEnabled:true},{status:200,headers:{'Cache-Control':'no-store'}});}catch(error){await recordSocialRun({triggerSource:'social-publish-auto-upload',startedAt,finishedAt:new Date().toISOString(),result:{status:'failed',reason:'exception'},error}).catch(()=>{});return NextResponse.json({status:'failed',error:String(error?.message||error).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,240),metaCalls:0},{status:503,headers:{'Cache-Control':'no-store'}})}}
export async function GET(request){if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});return execute();}
export async function POST(request){return GET(request);}
