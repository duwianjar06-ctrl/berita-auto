import sharp from 'sharp';
import {readArticles} from '../../../../lib/storage.js';
import {socialVisualProfile,socialCardText,buildSocialSlides} from '../../../../lib/social-visual.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';

const text=value=>typeof value==='string'?value.trim():value==null?'':String(value).trim();
const arr=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.values)?value.values:[];
const clip=(value,max)=>text(value).replace(/\s+/g,' ').slice(0,max).trim();
const esc=value=>text(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const wrap=(value,maxChars,maxLines=4)=>{const words=clip(value,1200).split(/\s+/).filter(Boolean);const lines=[];let line='';for(const word of words){const next=line?`${line} ${word}`:word;if(next.length<=maxChars)line=next;else{if(line)lines.push(line);line=word;if(lines.length>=maxLines-1)break;}}if(line&&lines.length<maxLines)lines.push(line);return lines;};
const tspans=(lines,x,dy)=>lines.map((line,index)=>`<tspan x="${x}" dy="${index?dy:0}">${esc(line)}</tspan>`).join('');

export function normalizeSocialArticle(article={}){
  const source=article&&typeof article==='object'?article:{};
  return {
    ...source,
    id:text(source.id),
    title:text(source.title)||'Berita terbaru',
    summary:text(source.summary||source.excerpt),
    excerpt:text(source.excerpt||source.summary),
    content:text(source.content||source.body||source.text),
    body:text(source.body),
    category:text(source.category)||'Berita',
    publisher:text(source.publisher||source.sourceName)||'Sumber publik',
    sourceName:text(source.sourceName||source.publisher)||'Sumber publik',
    imageUrl:text(source.imageUrl),
    topics:arr(source.topics),
    keywords:arr(source.keywords),
    entities:arr(source.entities),
    paragraphs:arr(source.paragraphs),
    slides:arr(source.slides)
  };
}

async function fetchLeadImage(article){
  const source=text(article.imageUrl);if(!/^https:\/\//i.test(source))return null;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);
  try{const response=await fetch(source,{method:'GET',signal:controller.signal,cache:'no-store',redirect:'follow',headers:{Accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*'}});const type=text(response.headers.get('content-type')).toLowerCase();const length=Number(response.headers.get('content-length')||0);if(!response.ok||!type.startsWith('image/')||(length&&length>8*1024*1024))return null;const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)return null;const jpeg=await sharp(bytes).jpeg({quality:88,mozjpeg:true}).toBuffer();return `data:image/jpeg;base64,${jpeg.toString('base64')}`;}catch{return null}finally{clearTimeout(timer);}
}

function renderSvg(article,slide,slides,leadImage){
  const profile=socialVisualProfile(article);const style=profile?.style||{accent:'#1d4ed8',icon:'NEWS'};const keywords=arr(profile?.keywords).map(text).filter(Boolean).slice(0,3).join(' • ');const content=socialCardText(article,slide)||{title:'Berita terbaru',summary:''};const isSecond=slide>1;const title=clip(content.title||article.title,180);const summary=clip(content.summary||article.summary||article.excerpt,760);const source=clip(article.publisher||article.sourceName||'Sumber publik',70);const titleLines=wrap(title,isSecond?34:29,4);const summaryLines=wrap(summary,isSecond?52:42,isSecond?8:4);const size=title.length>125?48:title.length>90?56:title.length>60?64:72;const bg=isSecond?'#f7f9fc':'#07111f';const titleColor='#ffffff';const summaryColor='#132238';const accent=esc(style.accent||'#1d4ed8');const slideCount=Math.max(1,Array.isArray(slides)?slides.length:2);
  const image=leadImage&&!isSecond?`<image href="${leadImage}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>`:'';
  const overlay=leadImage&&!isSecond?`<rect x="0" y="0" width="1080" height="1350" fill="url(#dark)"/>`:'';
  const titleY=isSecond?420:500;const summaryY=isSecond?720:900;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".72"/><stop offset=".48" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".82"/></linearGradient></defs><rect width="1080" height="1350" fill="${bg}"/>${image}${overlay}<circle cx="1040" cy="20" r="390" fill="${accent}" opacity="${leadImage&&!isSecond?'.08':'.18'}"/>${!isSecond?'<rect x="52" y="52" width="270" height="58" rx="22" fill="#000" fill-opacity=".58" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><text x="72" y="90" fill="#fff" font-family="Arial, sans-serif" font-size="24" font-weight="800">BERITA AUTO</text>':''}<text x="72" y="170" fill="${isSecond?'#07111f':'#fff'}" font-family="Arial, sans-serif" font-size="38" font-weight="900">BERITA AUTO</text><rect x="790" y="132" width="218" height="54" rx="24" fill="${accent}"/><text x="815" y="168" fill="#fff" font-family="Arial, sans-serif" font-size="24" font-weight="800">${esc(clip(profile.category,22))}</text><text x="72" y="245" fill="${isSecond?'#7ea4c7':'#e6eef7'}" font-family="Arial, sans-serif" font-size="24" font-weight="800">${isSecond?'LANJUTAN • POIN PENTING':'BERITA TERKINI'}</text>${!isSecond?`<text x="72" y="285" fill="#fff" font-family="Arial, sans-serif" font-size="22" font-weight="800">${esc(style.icon)}${keywords?` • ${esc(keywords)}`:''}</text>`:''}<text x="72" y="${titleY}" fill="${titleColor}" font-family="Arial, sans-serif" font-size="${size}" font-weight="900">${tspans(titleLines,72,Math.round(size*1.08))}</text><rect x="72" y="${summaryY-50}" width="930" height="${isSecond?430:300}" rx="28" fill="${isSecond?'#f7f9fc':'#f5f7fa'}" fill-opacity="${isSecond?'1':'.96'}" stroke="${isSecond?'#dbe5ef':'none'}" stroke-width="1"/><text x="112" y="${summaryY}" fill="${summaryColor}" font-family="Arial, sans-serif" font-size="${isSecond?32:30}" font-weight="500">${tspans(summaryLines,112,isSecond?45:43)}</text>${!isSecond?`<text x="112" y="${summaryY+190}" fill="#132238" font-family="Arial, sans-serif" font-size="23" font-weight="800">Sumber: ${esc(source)}</text>`:''}<text x="72" y="1285" fill="${isSecond?'#7a8da3':'#eef5fb'}" font-family="Arial, sans-serif" font-size="24" font-weight="700">berita-auto.vercel.app</text><text x="500" y="1290" fill="${isSecond?'#1d4ed8':'#fff'}" font-family="Arial, sans-serif" font-size="58" font-weight="900">BA</text><text x="920" y="1288" fill="${isSecond?'#7a8da3':'#eef5fb'}" font-family="Arial, sans-serif" font-size="22" font-weight="800">${slide}/${slideCount}</text></svg>`;
}

export async function GET(request,{params}){
  const {articleId}=await params;const raw=(await readArticles()).find(item=>item.id===articleId);if(!raw)return new Response('Not found',{status:404});const article=normalizeSocialArticle(raw);const url=new URL(request.url);const slide=Math.max(1,Number(url.searchParams.get('slide')||1));const slides=buildSocialSlides(article);const leadImage=slide===1?await fetchLeadImage(article):null;const svg=renderSvg(article,slide,slides,leadImage);const jpeg=await sharp(Buffer.from(svg)).jpeg({quality:88,mozjpeg:true}).toBuffer();return new Response(jpeg,{status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=600','Content-Length':String(jpeg.length)}});
}
