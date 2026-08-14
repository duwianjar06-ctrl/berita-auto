import {NextResponse} from 'next/server';
import {runPublicationCycle} from '../../../../worker/run.js';

export const dynamic='force-dynamic';

function authorized(request){
  const secret=process.env.CRON_SECRET||'';
  const auth=request.headers.get('authorization')||'';
  return Boolean(secret&&auth===`Bearer ${secret}`);
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const result=await runPublicationCycle({trigger:'vercel-cron',now:Date.now()});
    return NextResponse.json(result,{status:200,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return NextResponse.json({status:'failed',error:String(error?.message||error).slice(0,240)},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
