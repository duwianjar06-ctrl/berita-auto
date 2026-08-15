import {NextResponse} from 'next/server';
import {put} from '@vercel/blob';
import {requireAdmin} from '../../../../../lib/admin-guard.js';
import {AD_ALLOWED_IMAGES,AD_MAX_UPLOAD_BYTES,validateImageBytes,validateImageFileMeta} from '../../../../../lib/ads.js';

export const runtime='nodejs';

function deny(result){if(!result)return NextResponse.json({error:'Unauthorized'},{status:401});if(result.forbidden)return NextResponse.json({error:'Forbidden'},{status:403})}

export async function POST(request){
  const admin=await requireAdmin();const denied=deny(admin);if(denied)return denied;
  if(!process.env.BLOB_READ_WRITE_TOKEN){console.warn('[ads] blob_storage_not_configured');return NextResponse.json({error:'Storage gambar belum dikonfigurasi.'},{status:503});}
  try{
    const form=await request.formData();
    const file=form.get('file');
    validateImageFileMeta(file);
    const buffer=Buffer.from(await file.arrayBuffer());
    if(buffer.length>AD_MAX_UPLOAD_BYTES||!validateImageBytes(buffer,String(file.type).toLowerCase()))return NextResponse.json({error:'File bukan gambar yang valid'},{status:400});
    const ext=Object.values(AD_ALLOWED_IMAGES[String(file.type).toLowerCase()]||[])[0]||'.img';
    const safeBase=String(file.name||'banner').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60)||'banner';
    const pathname=`ads/${Date.now()}-${safeBase}${ext}`;
    const blob=await put(pathname,buffer,{access:'public',contentType:file.type,addRandomSuffix:true,token:process.env.BLOB_READ_WRITE_TOKEN});
    return NextResponse.json({url:blob.url,pathname:blob.pathname,contentType:file.type,size:buffer.length},{status:201});
  }catch(error){return NextResponse.json({error:error.message||'Unable to upload image'},{status:400})}
}
