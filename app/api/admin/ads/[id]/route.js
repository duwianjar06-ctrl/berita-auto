import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {persistenceConfigured} from '../../../../../lib/persistence.js';
import {getAd,listAds,normalizeAdPayload,persistAd,removeAd,isVercelBlobUrl} from '../../../../../lib/ads.js';
import {del as deleteBlob} from '@vercel/blob';

function deny(result){if(!result)return NextResponse.json({error:'Unauthorized'},{status:401});if(result.forbidden)return NextResponse.json({error:'Forbidden'},{status:403})}

export async function PUT(request,{params}){
  const admin=await requireAdmin();const denied=deny(admin);if(denied)return denied;
  if(!persistenceConfigured())return NextResponse.json({error:'Persistent admin database is not configured'},{status:503});
  try{
    const {id}=await params;const existing=await getAd(id);if(!existing)return NextResponse.json({error:'Ad not found'},{status:404});
    const body=await request.json();
    const updated=normalizeAdPayload(body,existing);
    const saved=await persistAd(updated);
    if(existing.imageUrl&&existing.imageUrl!==saved.imageUrl&&isVercelBlobUrl(existing.imageUrl)){
      const stillUsed=(await listAds()).some(row=>row.id!==saved.id&&row.imageUrl===existing.imageUrl);
      if(!stillUsed){try{await deleteBlob(existing.imageUrl)}catch(error){console.warn(`[ads] orphan_image_cleanup_failed=${error?.message||'unknown'}`)}}
    }
    return NextResponse.json(saved);
  }catch(error){return NextResponse.json({error:error.message||'Unable to update ad'},{status:400})}
}

export async function DELETE(request,{params}){
  const admin=await requireAdmin();const denied=deny(admin);if(denied)return denied;
  if(!persistenceConfigured())return NextResponse.json({error:'Persistent admin database is not configured'},{status:503});
  try{
    const {id}=await params;const existing=await getAd(id);if(!existing)return NextResponse.json({error:'Ad not found'},{status:404});
    const remaining=(await listAds()).filter(row=>row.id!==id);
    const removed=await removeAd(id);
    if(removed?.imageUrl&&isVercelBlobUrl(removed.imageUrl)&&!remaining.some(row=>row.imageUrl===removed.imageUrl)){
      try{await deleteBlob(removed.imageUrl)}catch(error){console.warn(`[ads] image_cleanup_failed=${error?.message||'unknown'}`)}
    }
    return NextResponse.json({ok:true,id});
  }catch(error){return NextResponse.json({error:'Unable to delete ad'},{status:400})}
}
