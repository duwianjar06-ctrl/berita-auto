import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../lib/admin-guard.js';
import {persistenceConfigured} from '../../../../lib/persistence.js';
import {listAds,normalizeAdPayload,persistAd} from '../../../../lib/ads.js';

function deny(result){if(!result)return NextResponse.json({error:'Unauthorized'},{status:401});if(result.forbidden)return NextResponse.json({error:'Forbidden'},{status:403})}

export async function GET(){
  const admin=await requireAdmin();const denied=deny(admin);if(denied)return denied;
  if(!persistenceConfigured())return NextResponse.json({error:'Persistent admin database is not configured'},{status:503});
  try{return NextResponse.json(await listAds())}catch(error){return NextResponse.json({error:'Ads unavailable',detail:error.message},{status:503})}
}

export async function POST(request){
  const admin=await requireAdmin();const denied=deny(admin);if(denied)return denied;
  if(!persistenceConfigured())return NextResponse.json({error:'Persistent admin database is not configured'},{status:503});
  try{
    const body=await request.json();
    const ad=normalizeAdPayload(body);
    const saved=await persistAd(ad);
    return NextResponse.json(saved,{status:201});
  }catch(error){return NextResponse.json({error:error.message||'Unable to save ad'},{status:400})}
}
