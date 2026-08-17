import path from 'node:path';
import fs from 'node:fs';
import {readArticles} from '../../../../lib/storage.js';
import {socialVisualProfile, socialCardText, buildSocialSlides, sanitizeCardText} from '../../../../lib/social-visual.js';
import {discoverImageSources, fetchValidatedImage} from '../../../../lib/social-image.js';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const fontDir=path.join(process.cwd(),'assets','fonts');
const regularFont=path.join(fontDir,'NotoSans-Regular.ttf');
const boldFont=path.join(fontDir,'NotoSans-Bold.ttf');
const regularExists=fs.existsSync(regularFont);
const boldExists=fs.existsSync(boldFont);
if(!regularExists||!boldExists)throw new Error(`social_card_bundled_font_missing:regular=${regularExists}:bold=${boldExists}`);
const fontconfigDir=path.join('/tmp','berita-auto-fontconfig');
const runtimeFontconfig=path.join(fontconfigDir,'fonts.conf');
fs.mkdirSync(fontconfigDir,{recursive:true});
const xml=`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontDir}</dir><dir>/usr/share/fonts</dir><dir>/usr/local/share/fonts</dir><dir>/opt/fonts</dir><cachedir>/tmp/fontconfig</cachedir></fontconfig>`;
fs.writeFileSync(runtimeFontconfig,xml,'utf8');
process.env.FONTCONFIG_FILE=runtimeFontconfig;
process.env.FONTCONFIG_PATH=fontconfigDir;
const {default:sharp}=await import('sharp');

const text=value=>sanitizeCardText(value);
const arr=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.values)?value.values:[];
const clip=(value,max)=>text(value).slice(0,max).trim();
const esc=value=>clip(value,2200).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

export const DESIGN_TOKENS={
  CANVAS_WIDTH:1080,
  CANVAS_HEIGHT:1350,
  SAFE_LEFT:76,
  SAFE_RIGHT:76,
  SAFE_TOP:46,
  SAFE_BOTTOM:58,
  PRIMARY_NAVY:'#061521',
  SECONDARY_NAVY:'#0b2231',
  ACCENT_GREEN:'#8bd63a',
  TEXT:'#f7fbff',
  MUTED:'#c7d8e2',
  TITLE_MAX_WIDTH:928,
  TITLE_MAX_LINES:5,
  TITLE_MIN_SIZE:48,
  CATEGORY_FONT:20,
  CATEGORY_PAD_X:22,
  CATEGORY_PAD_Y:5,
  CTA_HEIGHT:76,
  CTA_WIDTH:720,
  CONTENT_PANEL_RADIUS:28,
  BODY_FONT:28,
  BODY_LINE_HEIGHT:42
};

const {
  CANVAS_WIDTH,CANVAS_HEIGHT,SAFE_LEFT,SAFE_RIGHT,SAFE_TOP,SAFE_BOTTOM,
  PRIMARY_NAVY,SECONDARY_NAVY,ACCENT_GREEN,TEXT,MUTED,TITLE_MAX_WIDTH,
  TITLE_MAX_LINES,TITLE_MIN_SIZE,CATEGORY_FONT,CATEGORY_PAD_X,CATEGORY_PAD_Y,
  CTA_HEIGHT,CTA_WIDTH,CONTENT_PANEL_RADIUS,BODY_FONT,BODY_LINE_HEIGHT
}=DESIGN_TOKENS;
const CONTENT_WIDTH=CANVAS_WIDTH-SAFE_LEFT-SAFE_RIGHT;

const widthCache=new Map();
async function measureTextWidth(value,fontSize,fontWeight=700){
  const clean=clip(value,1200);
  if(!clean)return 0;
  const key=`${fontWeight}:${fontSize}:${clean}`;
  if(widthCache.has(key))return widthCache.get(key);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="180"><text x="20" y="120" font-family="Noto Sans" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="0">${esc(clean)}</text></svg>`;
  try{
    const meta=await sharp(Buffer.from(svg)).trim().metadata();
    const width=Math.max(0,Number(meta.width||0));
    widthCache.set(key,width);
    return width;
  }catch{
    const width=clean.length*fontSize*0.46;
    widthCache.set(key,width);
    return width;
  }
}

function conservativeWrap(value,maxWidth,fontSize,maxLines){
  const words=esc(value).split(/\s+/).filter(Boolean);
  const maxChars=Math.max(12,Math.floor(maxWidth/(fontSize*0.50)));
  const lines=[];
  let line='';
  for(const word of words){
    const next=line?`${line} ${word}`:word;
    if(next.length<=maxChars){line=next;continue;}
    if(line)lines.push(line);
    line=word;
    if(lines.length===maxLines)break;
  }
  if(line&&lines.length<maxLines)lines.push(line);
  return lines.slice(0,maxLines);
}

export async function fitHeadline(value,maxWidth=TITLE_MAX_WIDTH,maxLines=TITLE_MAX_LINES){
  const source=clip(value,300);
  const sizes=[76,72,68,64,60,56,52,TITLE_MIN_SIZE];
  for(const fontSize of sizes){
    const lines=conservativeWrap(source,maxWidth,fontSize,maxLines);
    if(!lines.length)continue;
    const measured=await Promise.all(lines.map(line=>measureTextWidth(line,fontSize,900)));
    const allFit=measured.every(width=>width<=maxWidth);
    const consumed=lines.join(' ').replace(/\s+/g,' ').length;
    if(allFit&&consumed>=Math.min(source.length,maxLines*18)){
      return{lines,fontSize,lineHeight:Math.round(fontSize*1.08),widths:measured};
    }
  }
  const fontSize=TITLE_MIN_SIZE;
  const lines=conservativeWrap(source,maxWidth,fontSize,maxLines);
  const measured=await Promise.all(lines.map(line=>measureTextWidth(line,fontSize,900)));
  const consumed=lines.join(' ').length;
  if(consumed>=source.length*0.72)return{lines,fontSize,lineHeight:52,widths:measured};
  const words=source.split(/\s+/);
  const safe=[];
  let current='';
  for(const word of words){
    const next=current?`${current} ${word}`:word;
    if(next.length<=maxLines*22)current=next;else break;
  }
  const shortened=current.replace(/[,:;.\s]+$/,'').trim();
  const safeLines=conservativeWrap(`${shortened}...`,maxWidth,fontSize,maxLines);
  const safeWidths=await Promise.all(safeLines.map(line=>measureTextWidth(line,fontSize,900)));
  return{lines:safeLines,fontSize,lineHeight:52,widths:safeWidths,shortened:true};
}

function fitBody(value,maxWidth,maxLines){
  const lines=conservativeWrap(clip(value,1500),maxWidth,BODY_FONT,maxLines);
  return lines.length?lines:['Informasi utama berita.'];
}

function tspans(lines,x,dy,maxWidth,widths=[]){
  return lines.map((line,index)=>{
    const measured=Number(widths[index]||0);
    const fit=measured>maxWidth?` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"`:'';
    return`<tspan x="${x}" dy="${index?dy:0}"${fit}>${line}</tspan>`;
  }).join('');
}

async function fetchArticleHtml(article){
  const url=article?.sourceUrl||article?.source||article?.originalUrl||article?.sourceArticleUrl;
  try{
    if(!/^https?:\/\//i.test(String(url||'')))return'';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),2800);
    const response=await fetch(url,{headers:{Accept:'text/html'},signal:controller.signal,redirect:'follow',cache:'no-store'});
    const body=response.ok?await response.text():'';
    clearTimeout(timer);
    return body.slice(0,500000);
  }catch{return'';}
}

async function resolveImages(article,html){
  const base=article?.sourceUrl||article?.originalUrl||article?.canonicalUrl||'';
  const candidates=discoverImageSources(article,html,base);
  const resolved=[];
  for(const candidate of candidates.slice(0,8)){
    const result=await fetchValidatedImage(candidate.url,{timeoutMs:1800});
    if(result.ok){
      resolved.push({provenance:candidate.provenance,url:result.url,...result});
      if(resolved.length>=2)break;
    }
  }
  return resolved;
}

async function imageData(url){
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),2500);
    const response=await fetch(url,{headers:{Accept:'image/avif,image/webp,image/jpeg,image/png'},signal:controller.signal,redirect:'follow',cache:'force-cache'});
    if(!response.ok){clearTimeout(timer);return null;}
    const bytes=Buffer.from(await response.arrayBuffer());
    clearTimeout(timer);
    if(!bytes.length)return null;
    const jpeg=await sharp(bytes).resize(CANVAS_WIDTH,CANVAS_HEIGHT,{fit:'cover',position:'attention',withoutEnlargement:false}).jpeg({quality:88,mozjpeg:true}).toBuffer();
    return`data:image/jpeg;base64,${jpeg.toString('base64')}`;
  }catch{return null;}
}

function fallbackVisual(){
  return`<rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="${PRIMARY_NAVY}"/>
    <circle cx="900" cy="220" r="310" fill="${ACCENT_GREEN}" fill-opacity=".10"/>
    <circle cx="170" cy="890" r="430" fill="#0d3a4f" fill-opacity=".65"/>
    <path d="M0 760 C240 620 420 890 690 740 C860 645 970 610 1080 660 L1080 1350 L0 1350 Z" fill="${ACCENT_GREEN}" fill-opacity=".045"/>
    <path d="M720 0 L1080 0 L1080 460 C930 390 820 300 720 0Z" fill="#1f5264" fill-opacity=".22"/>`;
}

function iconForCategory(category){
  const lower=String(category||'').toLowerCase();
  if(lower.includes('ekonomi'))return'↗';
  if(lower.includes('internasional'))return'◎';
  if(lower.includes('teknologi'))return'⌁';
  if(lower.includes('bencana'))return'!';
  if(lower.includes('olahraga'))return'•';
  return'✦';
}

async function renderSvg(article,slide,slides,images){
  const profile=socialVisualProfile(article);
  const content=socialCardText(article,slide)||{title:'Berita terbaru',summary:''};
  const isCover=slide===1;
  const slideCount=Math.max(1,slides.length);
  const category=clip(profile.category||article?.category||'Berita',34);
  const title=clip(content.title||article?.title||'Berita terbaru',300);
  const summary=clip(content.summary||article?.summary||article?.excerpt||'',1500);
  const source=clip(article?.publisher||article?.sourceName||'Sumber publik',72);
  const headline=await fitHeadline(title,TITLE_MAX_WIDTH,TITLE_MAX_LINES);
  const categoryTextWidth=await measureTextWidth(category,CATEGORY_FONT,800);
  const categoryWidth=Math.max(124,Math.min(CONTENT_WIDTH,Math.ceil(categoryTextWidth+CATEGORY_PAD_X*2+30)));
  const categoryHeight=CATEGORY_FONT+CATEGORY_PAD_Y*2+2;
  const categoryX=CANVAS_WIDTH-SAFE_RIGHT-categoryWidth;
  const categoryY=SAFE_TOP;
  const categoryCenterX=categoryX+categoryWidth/2;
  const categoryCenterY=categoryY+categoryHeight/2;
  const categoryTextCenterX=categoryCenterX+8;
  const image=images[0]||null;

  const titleY=isCover?520:330;
  const titleHeight=headline.lines.length*headline.lineHeight;
  const labelY=isCover?472:290;
  const bodyY=isCover?titleY+titleHeight+34:435;
  const panelX=SAFE_LEFT;
  const panelW=CONTENT_WIDTH;
  const bodyLines=fitBody(summary,panelW-64,isCover?4:6);
  const bodyHeight=Math.max(150,bodyLines.length*BODY_LINE_HEIGHT+82);
  const panelY=isCover?Math.max(700,bodyY-28):Math.min(770,bodyY-54);
  const panelH=Math.min(isCover?220:370,bodyHeight);
  const ctaW=Math.min(CTA_WIDTH,CONTENT_WIDTH);
  const ctaX=SAFE_LEFT+Math.round((CONTENT_WIDTH-ctaW)/2);
  const ctaY=1135;
  const indicatorY=isCover?418:188;
  const indicatorW=116;
  const indicatorH=48;

  const bulletSentences=summary.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0,4);
  const bulletLines=bulletSentences.length?bulletSentences:[summary];
  const bulletY=420;
  const bulletLineHeight=36;
  const bulletBlockHeight=bulletLines.reduce((acc,line)=>acc+Math.max(1,Math.ceil(line.length/58))*bulletLineHeight+28,0);
  const infoPanelY=Math.min(790,bulletY+bulletBlockHeight+20);
  const infoPanelH=Math.min(300,Math.max(130,bulletLines.length*72+44));

  const imageLayer=image
    ?`<image href="${image}" x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid slice" opacity="${isCover?'.92':'.42'}"/>`
    :fallbackVisual();

  const defs=`<defs>
    <linearGradient id="photoOverlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PRIMARY_NAVY}" stop-opacity=".10"/>
      <stop offset=".35" stop-color="${PRIMARY_NAVY}" stop-opacity=".18"/>
      <stop offset=".62" stop-color="${PRIMARY_NAVY}" stop-opacity=".68"/>
      <stop offset=".84" stop-color="${PRIMARY_NAVY}" stop-opacity=".93"/>
      <stop offset="1" stop-color="${PRIMARY_NAVY}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="detailOverlay" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${PRIMARY_NAVY}" stop-opacity=".90"/>
      <stop offset=".55" stop-color="${PRIMARY_NAVY}" stop-opacity=".66"/>
      <stop offset="1" stop-color="${PRIMARY_NAVY}" stop-opacity=".25"/>
    </linearGradient>
    <radialGradient id="glow" cx=".12" cy=".72" r=".48">
      <stop offset="0" stop-color="${ACCENT_GREEN}" stop-opacity=".18"/>
      <stop offset="1" stop-color="${ACCENT_GREEN}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

  const overlay=`<rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="${isCover?'url(#photoOverlay)':'url(#detailOverlay)'}"/>
    <rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#glow)"/>`;

  const header=`<g>
    <rect x="${SAFE_LEFT}" y="${SAFE_TOP+2}" width="58" height="42" rx="12" fill="${ACCENT_GREEN}"/>
    <text x="${SAFE_LEFT+29}" y="${SAFE_TOP+31}" text-anchor="middle" fill="${PRIMARY_NAVY}" font-family="Noto Sans" font-size="23" font-weight="900">BA</text>
    <text x="${SAFE_LEFT+74}" y="${SAFE_TOP+30}" fill="${TEXT}" font-family="Noto Sans" font-size="25" font-weight="800" letter-spacing=".2">BERITA AUTO</text>
    <rect x="${categoryX}" y="${categoryY}" width="${categoryWidth}" height="${categoryHeight}" rx="${categoryHeight/2}" fill="${ACCENT_GREEN}" stroke="#dcffb4" stroke-opacity=".30" stroke-width="1"/>
    <circle cx="${categoryX+24}" cy="${categoryCenterY}" r="10" fill="${PRIMARY_NAVY}" fill-opacity=".16"/>
    <text x="${categoryX+24}" y="${categoryCenterY+1}" text-anchor="middle" dominant-baseline="middle" fill="${PRIMARY_NAVY}" font-family="Noto Sans" font-size="14" font-weight="900">${iconForCategory(category)}</text>
    <text x="${categoryTextCenterX}" y="${categoryCenterY+1}" text-anchor="middle" dominant-baseline="middle" fill="${PRIMARY_NAVY}" font-family="Noto Sans" font-size="${CATEGORY_FONT}" font-weight="900">${esc(category)}</text>
  </g>`;

  const indicator=`<g>
    <rect x="${SAFE_LEFT}" y="${indicatorY}" width="${indicatorW}" height="${indicatorH}" rx="24" fill="${PRIMARY_NAVY}" fill-opacity=".58" stroke="#d8edf5" stroke-opacity=".72" stroke-width="1.5"/>
    <text x="${SAFE_LEFT+indicatorW/2}" y="${indicatorY+31}" text-anchor="middle" fill="${ACCENT_GREEN}" font-family="Noto Sans" font-size="20" font-weight="900">${slide} / ${slideCount}</text>
  </g>`;

  const label=`<text x="${SAFE_LEFT}" y="${labelY}" fill="${ACCENT_GREEN}" font-family="Noto Sans" font-size="18" font-weight="900" letter-spacing="1.8">${esc(isCover?'BERITA TERKINI':'POIN PENTING')}</text>`;
  const titleSvg=`<text x="${SAFE_LEFT}" y="${titleY}" fill="${TEXT}" font-family="Noto Sans" font-size="${headline.fontSize}" font-weight="900" letter-spacing="-1.0">${tspans(headline.lines,SAFE_LEFT,headline.lineHeight,TITLE_MAX_WIDTH,headline.widths)}</text>`;

  const panel=`<rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="${CONTENT_PANEL_RADIUS}" fill="${SECONDARY_NAVY}" fill-opacity=".74" stroke="#c7e6f0" stroke-opacity=".18" stroke-width="1.5"/>
    <rect x="${panelX}" y="${panelY}" width="6" height="${panelH}" rx="3" fill="${ACCENT_GREEN}"/>`;
  const bodySvg=`<text x="${panelX+32}" y="${panelY+58}" fill="${TEXT}" font-family="Noto Sans" font-size="${BODY_FONT}" font-weight="500">${tspans(bodyLines,panelX+32,BODY_LINE_HEIGHT,panelW-64)}</text>`;

  let detailSvg='';
  if(!isCover){
    const items=bulletLines.slice(0,3);
    const lineEnd=bulletY+Math.max(0,(items.length-1)*86);
    detailSvg+=`<line x1="${SAFE_LEFT+2}" y1="${bulletY+6}" x2="${SAFE_LEFT+2}" y2="${lineEnd+6}" stroke="#b8d9c0" stroke-opacity=".32" stroke-width="2"/>`;
    items.forEach((item,index)=>{
      const y=bulletY+14+index*86;
      const lines=conservativeWrap(item,CONTENT_WIDTH-54,24,2);
      detailSvg+=`<circle cx="${SAFE_LEFT+2}" cy="${bulletY+6+index*86}" r="7" fill="${ACCENT_GREEN}"/>`;
      detailSvg+=`<text x="${SAFE_LEFT+28}" y="${y}" fill="${TEXT}" font-family="Noto Sans" font-size="24" font-weight="500">${lines.map((line,i)=>`<tspan x="${SAFE_LEFT+28}" dy="${i?31:0}">${line}</tspan>`).join('')}</text>`;
    });
    detailSvg+=`<rect x="${SAFE_LEFT}" y="${infoPanelY}" width="${CONTENT_WIDTH}" height="${infoPanelH}" rx="28" fill="${SECONDARY_NAVY}" fill-opacity=".76" stroke="#c7e6f0" stroke-opacity=".20" stroke-width="1.5"/>`;
    items.forEach((item,index)=>{
      const y=infoPanelY+48+index*82;
      const fact=clip(item,100);
      detailSvg+=`<circle cx="${SAFE_LEFT+34}" cy="${y-6}" r="15" fill="${ACCENT_GREEN}" fill-opacity=".20"/><text x="${SAFE_LEFT+34}" y="${y}" text-anchor="middle" fill="${ACCENT_GREEN}" font-family="Noto Sans" font-size="17" font-weight="900">${index+1}</text><text x="${SAFE_LEFT+62}" y="${y}" fill="${TEXT}" font-family="Noto Sans" font-size="21" font-weight="600">${esc(fact)}</text>`;
      if(index<items.length-1)detailSvg+=`<line x1="${SAFE_LEFT+62}" y1="${y+28}" x2="${CANVAS_WIDTH-SAFE_RIGHT-24}" y2="${y+28}" stroke="#b8d9c0" stroke-opacity=".18" stroke-width="1"/>`;
    });
  }

  const cta=`<g>
    <rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="${CTA_HEIGHT}" rx="${CTA_HEIGHT/2}" fill="${SECONDARY_NAVY}" fill-opacity=".94" stroke="#c7e6f0" stroke-opacity=".25" stroke-width="1.5"/>
    <circle cx="${ctaX+40}" cy="${ctaY+CTA_HEIGHT/2}" r="23" fill="${ACCENT_GREEN}"/>
    <circle cx="${ctaX+40}" cy="${ctaY+CTA_HEIGHT/2}" r="10" fill="none" stroke="${PRIMARY_NAVY}" stroke-width="2"/>
    <path d="M${ctaX+30} ${ctaY+CTA_HEIGHT/2}h20 M${ctaX+40} ${ctaY+CTA_HEIGHT/2-10}v20" stroke="${PRIMARY_NAVY}" stroke-width="2" stroke-linecap="round"/>
    <text x="${ctaX+78}" y="${ctaY+31}" fill="${MUTED}" font-family="Noto Sans" font-size="17" font-weight="700">Baca Selengkapnya di</text>
    <text x="${ctaX+78}" y="${ctaY+56}" fill="${ACCENT_GREEN}" font-family="Noto Sans" font-size="22" font-weight="900">berita-auto.vercel.app</text>
    <circle cx="${ctaX+ctaW-40}" cy="${ctaY+CTA_HEIGHT/2}" r="23" fill="${ACCENT_GREEN}"/>
    <path d="M${ctaX+ctaW-50} ${ctaY+CTA_HEIGHT/2}h19 M${ctaX+ctaW-40} ${ctaY+CTA_HEIGHT/2-9}l9 9-9 9" stroke="${PRIMARY_NAVY}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>`;

  const footer=`<text x="${SAFE_LEFT}" y="1278" fill="#8ca6b3" font-family="Noto Sans" font-size="15" font-weight="600">${esc(source)}</text>
    <text x="${CANVAS_WIDTH-SAFE_RIGHT}" y="1278" text-anchor="end" fill="${ACCENT_GREEN}" font-family="Noto Sans" font-size="18" font-weight="900">BERITA AUTO</text>
    ${Array.from({length:Math.min(slideCount,6)},(_,index)=>`<circle cx="${SAFE_LEFT+index*18}" cy="1308" r="4" fill="${index===slide-1?ACCENT_GREEN:'#54707e'}"/>`).join('')}`;

  return`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">
    ${defs}${imageLayer}${overlay}${header}${indicator}${label}${titleSvg}
    ${isCover?panel+bodySvg:detailSvg}
    ${cta}${footer}
  </svg>`;
}

export function normalizeSocialArticle(article={}){
  const source=article&&typeof article==='object'?article:{};
  return{
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
    sourceUrl:text(source.sourceUrl||source.source||source.originalUrl),
    canonicalUrl:text(source.canonicalUrl),
    imageUrl:text(source.imageUrl),
    topics:arr(source.topics),
    keywords:arr(source.keywords),
    entities:arr(source.entities),
    paragraphs:arr(source.paragraphs),
    slides:arr(source.slides)
  };
}

export async function GET(request,{params}){
  const started=Date.now();
  const {articleId}=await params;
  const raw=(await readArticles()).find(item=>item.id===articleId);
  if(!raw)return new Response('Not found',{status:404});
  const article=normalizeSocialArticle(raw);
  const url=new URL(request.url);
  const slide=Math.max(1,Number(url.searchParams.get('slide')||1));
  const slides=buildSocialSlides(article);
  if(slide>slides.length)return new Response('Slide not found',{status:404});
  const html=await fetchArticleHtml(article);
  const resolved=await resolveImages(article,html);
  const imageDataUrls=[];
  for(const item of resolved){
    const data=await imageData(item.url);
    if(data)imageDataUrls.push(data);
    if(imageDataUrls.length>=2)break;
  }
  const renderStarted=Date.now();
  const svg=await renderSvg(article,slide,slides,imageDataUrls);
  const jpeg=await sharp(Buffer.from(svg)).jpeg({quality:88,mozjpeg:true}).toBuffer();
  console.log(`[social-card] articleId=${articleId} slide=${slide} image=${resolved[0]?.provenance||'FALLBACK'} image2=${resolved[1]?.provenance||'NONE'} slides=${slides.length} renderMs=${Date.now()-renderStarted} totalMs=${Date.now()-started}`);
  return new Response(jpeg,{status:200,headers:{
    'Content-Type':'image/jpeg',
    'Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    'Content-Length':String(jpeg.length),
    'X-Social-Card-Render':'valid',
    'X-Social-Card-Slide-Count':String(slides.length),
    'X-Social-Card-Image-Provenance':String(resolved[0]?.provenance||'FALLBACK'),
    'X-Social-Card-Image-2-Provenance':String(resolved[1]?.provenance||'NONE'),
    'X-Social-Card-Font-Source':'bundled-ttf'
  }});
}
