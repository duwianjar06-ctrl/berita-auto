import {readArticles} from '../../../../lib/storage.js';
import {recordView} from '../../../../lib/analytics.js';

export const dynamic='force-dynamic';

export async function POST(request){
  try{
    const body=await request.json();
    const articleId=String(body.articleId||'').trim();
    if(!/^[a-f0-9]{20,64}$/i.test(articleId))return Response.json({ok:false},{status:400});
    const articles=await readArticles();
    if(!articles.some(a=>a.id===articleId||a.fingerprint===articleId))return Response.json({ok:false},{status:404});
    const ua=request.headers.get('user-agent')||'';
    if(/bot|crawler|spider|slurp|headless|facebookexternalhit|googlebot|bingbot|ahrefs|semrush|uptime|monitor/i.test(ua))return Response.json({ok:true,counted:false});
    const cookieName=`ba_view_${articleId.slice(0,32)}`;
    const cookies=request.headers.get('cookie')||'';
    if(new RegExp(`(?:^|;\\s*)${cookieName}=1(?:;|$)`).test(cookies))return Response.json({ok:true,counted:false});
    await recordView({articleId,country:request.headers.get('x-vercel-ip-country'),region:request.headers.get('x-vercel-ip-country-region'),city:request.headers.get('x-vercel-ip-city')});
    const response=Response.json({ok:true,counted:true});
    response.headers.set('Cache-Control','no-store');
    response.headers.append('Set-Cookie',`${cookieName}=1; Path=/; Max-Age=300; SameSite=Lax; Secure`);
    return response;
  }catch(error){console.error('[analytics:view]',error);return Response.json({ok:false},{status:503})}
}
