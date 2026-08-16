import path from 'node:path';
import sharp from 'sharp';
import {readArticles} from '../../../../lib/storage.js';
import {socialVisualProfile,socialCardText,buildSocialSlides} from '../../../../lib/social-visual.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';

const fontconfigDir=path.join(process.cwd(),'fontconfig');
if(!process.env.FONTCONFIG_FILE)process.env.FONTCONFIG_FILE=path.join(fontconfigDir,'fonts.conf');
if(!process.env.FONTCONFIG_PATH)process.env.FONTCONFIG_PATH=fontconfigDir;

const text=value=>typeof value==='string'?value.trim():value==null?'':String(value).trim();
const arr=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.values)?value.values:[];
const clip=(value,max)=>text(value).replace(/\s+/g,' ').slice(0,max).trim();
const safeText=value=>clip(value,1200).normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}\s.,!?;:'"()\-/%&@+#=]/gu,' ').replace(/\s+/g,' ').trim();
const esc=value=>safeText(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const wrap=(value,maxChars,maxLines=4)=>{const words=safeText(value).split(/\s+/).filter(Boolean);const lines=[];let line='';for(const word of words){const next=line?`${line} ${word}`:word;if(next.length<=maxChars)line=next;else{if(line)lines.push(line);line=word;if(lines.length>=maxLines-1)break;}}if(line&&lines.length<maxLines)lines.push(line);return lines;};
const tspans=(lines,x,dy)=>lines.map((line,index)=>`<tspan x="${x}" dy="${index?dy:0}">${esc(line)}</tspan>`).join('');

export function normalizeSocialArticle(article={}){
  const source=article&&typeof article==='object'?article:{};
  return {...source,id:text(source.id),title:text(source.title)||'Berita terbaru',summary:text(source.summary||source.excerpt),excerpt:text(source.excerpt||source.summary),content:text(source.content||source.body||source.text),body:text(source.body),category:text(source.category)||'Berita',publisher:text(source.publisher||source.sourceName)||'Sumber publik',sourceName:text(source.sourceName||source.publisher)||'Sumber publik',imageUrl:text(source.imageUrl),topics:arr(source.topics),keywords:arr(source.keywords),entities:arr(source.entities),paragraphs:arr(source.paragraphs),slides:arr(source.slides)};
}

async function fetchLeadImage(article){
  const source=text(article.imageUrl);if(!/^https:\/\//i.test(source))return null;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3500);
  try{const response=await fetch(source,{method:'GET',signal:controller.signal,cache:'force-cache',redirect:'follow',headers:{Accept:'image/avif,image/webp,image/jpeg,image/png'}});const type=text(response.headers.get('content-type')).toLowerCase();const length=Number(response.headers.get('content-length')||0);if(!response.ok||!type.startsWith('image/')||(length&&length>8*1024*1024))return null;const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)return null;const jpeg=await sharp(bytes).resize(1080,900,{fit:'cover',position:'attention',withoutEnlargement:true}).jpeg({quality:80,mozjpeg:true}).toBuffer();return `data:image/jpeg;base64,${jpeg.toString('base64')}`;}catch{return null}finally{clearTimeout(timer);}
}

function renderSvg(article,slide,slides,leadImage){
  const profile=socialVisualProfile(article);const style=profile?.style||{accent:'#1d4ed8',icon:'NEWS'};const keywords=arr(profile?.keywords).map(safeText).filter(Boolean).slice(0,3).join(' | ');const content=socialCardText(article,slide)||{title:'Berita terbaru',summary:''};const isSecond=slide>1;const title=clip(content.title||article.title,180);const summary=clip(content.summary||article.summary||article.excerpt,760);const source=clip(article.publisher||article.sourceName||'Sumber publik',70);const titleLines=wrap(title,isSecond?34:30,isSecond?3:4);const summaryLines=wrap(summary,isSecond?54:46,isSecond?9:4);const size=isSecond?52:(title.length>125?46:title.length>90?54:title.length>60?62:70);const bg=isSecond?'#f5f7fa':'#07111f';const accent=esc(style.accent||'#1d4ed8');const slideCount=Math.max(1,Array.isArray(slides)?slides.length:2);const font='DejaVu Sans';
  const image=leadImage&&!isSecond?`<image href="${leadImage}" x="0" y="0" width="1080" height="900" preserveAspectRatio="xMidYMid slice"/>`:'';
  const overlay=leadImage&&!isSecond?`<rect x="0" y="0" width="1080" height="930" fill="url(#dark)"/>`:'';
  const titleY=isSecond?360:585;const summaryY=isSecond?555:910;
  const slideOne=!isSecond?`<text x="72" y="${titleY}" fill="#fff" font-family="${font}" font-size="${size}" font-weight="700">${tspans(titleLines,72,Math.round(size*1.1))}</text><rect x="72" y="${summaryY-54}" width="936" height="${Math.min(235,Math.max(180,summaryLines.length*43+74))}" rx="24" fill="#fff" fill-opacity=".94"/><text x="108" y="${summaryY}" fill="#142238" font-family="${font}" font-size="29" font-weight="400">${tspans(summaryLines,108,42)}</text><text x="108" y="${summaryY+150}" fill="#53677c" font-family="${font}" font-size="20" font-weight="700">Sumber: ${esc(source)}</text>`:'';
  const slideTwo=isSecond?`<text x="72" y="${titleY}" fill="#0b1728" font-family="${font}" font-size="${size}" font-weight="700">${tspans(titleLines,72,Math.round(size*1.1))}</text><rect x="72" y="${summaryY-42}" width="936" height="520" rx="28" fill="#fff" stroke="#d9e2ec" stroke-width="2"/><text x="112" y="${summaryY+8}" fill="#182b3f" font-family="${font}" font-size="30" font-weight="400">${tspans(summaryLines,112,44)}</text>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".05"/><stop offset=".5" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient></defs><rect width="1080" height="1350" fill="${bg}"/>${image}${overlay}<rect x="0" y="0" width="1080" height="1350" fill="${accent}" fill-opacity="${isSecond?'.07':'.035'}"/><text x="72" y="88" fill="${isSecond?'#0b1728':'#fff'}" font-family="${font}" font-size="30" font-weight="700">BERITA AUTO</text><rect x="790" y="48" width="218" height="54" rx="24" fill="${accent}"/><text x="815" y="83" fill="#fff" font-family="${font}" font-size="21" font-weight="700">${esc(clip(profile.category,22))}</text><text x="72" y="142" fill="${isSecond?'#58708a':'#e8f1f8'}" font-family="${font}" font-size="21" font-weight="700">${isSecond?'LANJUTAN BERITA':'BERITA TERKINI'}${!isSecond&&keywords?` | ${esc(keywords)}`:''}</text>${slideOne}${slideTwo}<text x="72" y="1285" fill="${isSecond?'#71849a':'#eaf3fa'}" font-family="${font}" font-size="21" font-weight="700">berita-auto.vercel.app</text><text x="500" y="1290" fill="${isSecond?'#1d4ed8':'#fff'}" font-family="${font}" font-size="54" font-weight="700">BA</text><text x="920" y="1288" fill="${isSecond?'#71849a':'#eaf3fa'}" font-family="${font}" font-size="20" font-weight="700">${slide}/${slideCount}</text></svg>`;
}

export async function GET(request,{params}){
  const started=Date.now();const {articleId}=await params;const raw=(await readArticles()).find(item=>item.id===articleId);if(!raw)return new Response('Not found',{status:404});const article=normalizeSocialArticle(raw);const url=new URL(request.url);const slide=Math.max(1,Number(url.searchParams.get('slide')||1));const slides=buildSocialSlides(article);const leadStarted=Date.now();const leadImage=slide===1?await fetchLeadImage(article):null;const renderStarted=Date.now();const svg=renderSvg(article,slide,slides,leadImage);const jpeg=await sharp(Buffer.from(svg)).jpeg({quality:86,mozjpeg:true}).toBuffer();console.log(`[social-card] articleId=${articleId} slide=${slide} image=${leadImage?'article':'fallback'} leadMs=${Date.now()-leadStarted} renderMs=${Date.now()-renderStarted} totalMs=${Date.now()-started}`);return new Response(jpeg,{status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=600','Content-Length':String(jpeg.length)}});
}
