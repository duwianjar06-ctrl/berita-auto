import {NextResponse} from 'next/server';
import {findArticle} from '../../../../lib/article-storage.js';
import {buildBrandedArticleFallbackSvg} from '../../../../lib/article-image.js';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(request,{params}){
  const articleId=String((await params)?.articleId||'');
  if(!articleId)return new NextResponse('Not Found',{status:404});
  const article=await findArticle(decodeURIComponent(articleId));
  if(!article)return new NextResponse('Not Found',{status:404});
  const svg=buildBrandedArticleFallbackSvg(article,{width:1200,height:675});
  return new NextResponse(svg.toString('utf8'),{status:200,headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400','X-Article-Image-Delivery':'dynamic-branded-fallback','X-Article-Image-Template':'3'}});
}

export async function HEAD(request,context){const response=await GET(request,context);return new NextResponse(null,{status:response.status,headers:response.headers});}
