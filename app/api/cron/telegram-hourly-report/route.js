import {NextResponse} from 'next/server';
import {sendTelegramHourlyReport} from '../../../../lib/telegram.js';

export const dynamic='force-dynamic';
export const runtime='nodejs';

function authorized(request){
  const secret=process.env.CRON_SECRET||'';
  const auth=request.headers.get('authorization')||'';
  return Boolean(secret&&auth===`Bearer ${secret}`);
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const result=await sendTelegramHourlyReport(Date.now());
    return NextResponse.json(result,{status:200,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error(`[telegram-hourly] failed ${String(error?.message||error).slice(0,240)}`);
    return NextResponse.json({status:'failed',error:'telegram_hourly_report_failed'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}

export async function POST(request){return GET(request);}
