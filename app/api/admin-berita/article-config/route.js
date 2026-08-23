import {auth} from '../../../../auth.js';
import {ARTICLE_CONFIG,articleConfigOverrides} from '../../../../lib/article-config.js';

export const dynamic='force-dynamic';

export async function GET(){
  let session=null;try{session=await auth()}catch{return Response.json({error:'unauthorized'},{status:401})}
  const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  const email=session?.user?.email?.trim().toLowerCase();
  if(!email||!allowed.includes(email))return Response.json({error:'forbidden'},{status:403});
  return Response.json({config:ARTICLE_CONFIG,overrides:articleConfigOverrides()},{headers:{'cache-control':'no-store'}});
}
