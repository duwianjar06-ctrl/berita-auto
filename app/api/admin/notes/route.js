import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {requireAdmin} from '../../../../lib/admin-guard.js';
import {persistenceConfigured,upsertIndexed,listJson} from '../../../../lib/persistence.js';

const INDEX='ba:notes:index';
const key=id=>`ba:notes:${id}`;
const clean=(v,max)=>String(v??'').trim().slice(0,max);
const note=(raw,email)=>({id:raw.id||randomUUID(),title:clean(raw.title,160)||'Catatan tanpa judul',content:clean(raw.content,10000),createdBy:raw.createdBy||email,createdByEmail:raw.createdByEmail||email,updatedBy:email,updatedByEmail:email,isPinned:Boolean(raw.isPinned??raw.pinned),createdAt:raw.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),deletedAt:null});
function deny(r){if(!r)return NextResponse.json({error:'Unauthorized'},{status:401});if(r.forbidden)return NextResponse.json({error:'Forbidden'},{status:403})}
export async function GET(){const r=await requireAdmin();const d=deny(r);if(d)return d;if(!persistenceConfigured())return NextResponse.json({error:'Persistent admin database is not configured'},{status:503});try{return NextResponse.json(await listJson(INDEX))}catch(error){return NextResponse.json({error:'Notes unavailable',detail:error.message},{status:503})}}
export async function POST(request){const r=await requireAdmin();const d=deny(r);if(d)return d;if(!persistenceConfigured())return NextResponse.json({error:'Persistent admin database is not configured'},{status:503});try{const body=await request.json();
 if(Array.isArray(body?.legacyNotes)){
   const existing=await listJson(INDEX);const signatures=new Set(existing.map(n=>`${n.title}\n${n.content}`));const imported=[];
   for(const raw of body.legacyNotes){const item=note(raw,r.email);const sig=`${item.title}\n${item.content}`;if(!item.content||signatures.has(sig))continue;signatures.add(sig);item.createdByEmail=r.email;item.updatedByEmail=r.email;await upsertIndexed(INDEX,key(item.id),item);imported.push(item)}
   return NextResponse.json({imported});
 }
 const item=note(body,r.email);if(!item.content)return NextResponse.json({error:'Content is required'},{status:400});await upsertIndexed(INDEX,key(item.id),item);return NextResponse.json(item,{status:201});
}catch(error){return NextResponse.json({error:'Unable to save note'},{status:400})}}
