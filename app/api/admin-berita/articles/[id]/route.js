import {auth} from '../../../../../auth.js';
import {findArticle} from '../../../../../lib/article-storage.js';
export const dynamic='force-dynamic';
async function guard(){const session=await auth().catch(()=>null);const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const email=session?.user?.email?.trim().toLowerCase();return Boolean(email&&allowed.includes(email));}
export async function GET(_request,{params}){if(!await guard())return Response.json({error:'unauthorized'},{status:401});const id=String((await params)?.id||'');if(!id)return Response.json({error:'article_id_required'},{status:400});const article=await findArticle(id);return article?Response.json({article}):Response.json({error:'article_not_found'},{status:404});}
