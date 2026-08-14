import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../lib/admin-guard.js';
import {getPipelineSnapshot} from '../../../../lib/pipeline.js';
export async function GET(){const r=await requireAdmin();if(!r)return NextResponse.json({error:'Unauthorized'},{status:401});if(r.forbidden)return NextResponse.json({error:'Forbidden'},{status:403});return NextResponse.json(await getPipelineSnapshot())}
