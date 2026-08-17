import path from 'node:path';
import fs from 'node:fs';
import {readArticles} from '../../../../lib/storage.js';
import {socialVisualProfile,socialCardText,buildSocialSlides,sanitizeCardText} from '../../../../lib/social-visual.js';
import {discoverImageSources,fetchValidatedImage} from '../../../../lib/social-image.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';

const fontDir=path.join(process.cwd(),'assets','fonts');
const regularFont=path.join(fontDir,'NotoSans-Regular.ttf');
const boldFont=path.join(fontDir,'NotoSans-Bold.ttf');
const regularExists=fs.existsSync(regularFont);const boldExists=fs.existsSync(boldFont);
if(!regularExists||!boldExists)throw new Error(`social_card_bundled_font_missing:regular=${regularExists}:bold=${boldExists}`);
const fontconfigDir=path.join('/tmp','berita-auto-fontconfig');const runtimeFontconfig=path.join(fontconfigDir,'fonts.conf');fs.mkdirSync(fontconfigDir,{recursive:true});
const xml=`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontDir}</dir><dir>/usr/share/fonts</dir><dir>/usr/local/share/fonts</dir><dir>/opt/fonts</dir><cachedir>/tmp/fontconfig</cachedir></fontconfig>`;fs.writeFileSync(runtimeFontconfig,xml,'utf8');process.env.FONTCONFIG_FILE=runtimeFontconfig;process.env.FONTCONFIG_PATH=fontconfigDir;
const {default:sharp}=await import('sharp');

const text=value=>sanitizeCardText(value);
const arr=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.values)?value.values:[];
const clip=(value,max)=>text(value).slice(0,max).trim();
const esc=value=>clip(value,1800).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

const CANVAS_WIDTH=1080;
const CANVAS_HEIGHT=1350;
const SAFE_HORIZONTAL=76;
const SAFE_TOP=46;
const SAFE_BOTTOM=58;
const CONTENT_WIDTH=CANVAS_WIDTH-(SAFE_HORIZONTAL*2);
const CONTENT_INSET=28;
const HEADLINE_MAX_WIDTH=CONTENT_WIDTH;
const HEADLINE_MAX_LINES=5;
const HEADLINE_MIN_SIZE=48;
const BODY_FONT=28;
const BODY_LINE_HEIGHT=42;
const CTA_HEIGHT=76;
const CTA_WIDTH=720;
const CATEGORY_FONT=20;
const CATEGORY_PAD_X=22;
const CATEGORY_PAD_Y=5;

function wrapWords(value,maxChars,maxLines){
 const words=esc(value).split(/\s+/).filter(Boolean);const lines=[];let line='';
 for(const word of words){
  const next=line?`${line} ${word}`:word;
  if(next.length<=maxChars){line=next;continue;}
  if(line)lines.push(line);
  line=word;
  if(lines.length>=maxLines)break;
 }
 if(line&&lines.length<maxLines)lines.push(line);
 return lines.slice(0,maxLines);
}

function shortenHeadline(value,maxChars){
 const cleanValue=clip(value,maxChars+1);
 if(cleanValue.length<=maxChars)return cleanValue;
 const words=cleanValue.slice(0,maxChars-4).trim().split(/\s+/);
 while(words.length&&words.join(' ').length>maxChars-4)words.pop();
 return `${words.join(' ')}...`;
}
function fitHeadline(value,maxWidth=HEADLINE_MAX_WIDTH,maxLines=HEADLINE_MAX_LINES){
 const sizes=[72,68,64,60,56,52,HEADLINE_MIN_SIZE];
 for(const fontSize of sizes){
  const maxChars=Math.max(18,Math.floor(maxWidth/(fontSize*0.50)));
  const lines=wrapWords(value,maxChars,maxLines);
  const consumed=lines.join(' ').replace(/\s+/g,' ').length;
  const longest=Math.max(0,...lines.map(line=>line.length));
  const estimatedWidth=longest*fontSize*0.50;
  if(lines.length<=maxLines&&consumed>=Math.min(value.length, maxChars*maxLines*0.92)&&estimatedWidth<=maxWidth*0.94)return{lines,fontSize,lineHeight:Math.round(fontSize*1.06)};
 }
 const fontSize=HEADLINE_MIN_SIZE;const maxChars=Math.max(18,Math.floor(maxWidth/(fontSize*0.50)));
 const safe=shortenHeadline(value,maxChars*maxLines);
 return{lines:wrapWords(safe,maxChars,maxLines),fontSize,lineHeight:51};
}

function fitBody(value,maxWidth,maxLines){
 const maxChars=Math.max(34,Math.floor(maxWidth/(BODY_FONT*0.49)));
 return wrapWords(value,maxChars,maxLines);
}

function tspans(lines,x,dy,maxWidth,fontSize){
 return lines.map((line,index)=>{
  const estimated=line.length*0.50;
  const estimatedWidth=estimated*Number(fontSize||1);
  const fitLength=maxWidth&&estimatedWidth>maxWidth*0.93?` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"`:'';
  return `<tspan x="${x}" dy="${index?dy:0}"${fitLength}>${line}</tspan>`;
 }).join('');
}

async function fetchArticleHtml(article){
 const url=article?.sourceUrl||article?.source||article?.originalUrl||article?.sourceArticleUrl;
 try{if(!/^https:\/\//i.test(String(url||'')))return'';const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2800);const response=await fetch(url,{headers:{Accept:'text/html'},signal:controller.signal,redirect:'follow',cache:'no-store'});const body=response.ok?await response.text():'';clearTimeout(timer);return body.slice(0,500000);}catch{return'';}
}

async function resolveImages(article,html){
 const base=article?.sourceUrl||article?.originalUrl||article?.canonicalUrl||'';const candidates=discoverImageSources(article,html,base);const resolved=[];
 for(const candidate of candidates.slice(0,12)){const result=await fetchValidatedImage(candidate.url,{timeoutMs:2200});if(result.ok){resolved.push({provenance:candidate.provenance,url:result.url,...result});if(resolved.length>=2)break;}}
 return resolved;
}

async function imageData(url){
 try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2500);const response=await fetch(url,{headers:{Accept:'image/avif,image/webp,image/jpeg,image/png'},signal:controller.signal,redirect:'follow',cache:'force-cache'});if(!response.ok){clearTimeout(timer);return null;}const bytes=Buffer.from(await response.arrayBuffer());clearTimeout(timer);if(!bytes.length)return null;const jpeg=await sharp(bytes).resize(CANVAS_WIDTH,900,{fit:'cover',position:'attention',withoutEnlargement:false}).jpeg({quality:86,mozjpeg:true}).toBuffer();return`data:image/jpeg;base64,${jpeg.toString('base64')}`;}catch{return null;}
}

function renderSvg(article,slide,slides,images){
 const profile=socialVisualProfile(article);const style=profile?.style||{accent:'#8bd63a',icon:'NEWS'};const content=socialCardText(article,slide)||{title:'Berita terbaru',summary:''};
 const isCover=slide===1;const slideCount=Math.max(1,slides.length);const accent='#8bd63a';const navy='#061521';const navy2='#0b2231';const white='#f7fbff';const muted='#c7d8e2';const bodyColor='#eef7fb';
 const title=clip(content.title||article.title,260);const summary=clip(content.summary||article.summary||article.excerpt,1500);const source=clip(article.publisher||article.sourceName||'Sumber publik',72);const category=clip(profile.category,34);
 const image=images[Math.min(slide-1,Math.max(0,images.length-1))]||images[0]||null;
 const headline=fitHeadline(title,HEADLINE_MAX_WIDTH,HEADLINE_MAX_LINES);const titleY=isCover?336:330;const titleHeight=headline.lines.length*headline.lineHeight;
 const panelY=Math.min(800,Math.max(705,titleY+titleHeight+34));const panelMaxLines=isCover?4:6;const bodyLines=fitBody(summary,CONTENT_WIDTH-(CONTENT_INSET*2),panelMaxLines);const panelHeight=Math.max(isCover?205:250,Math.min(330,72+bodyLines.length*BODY_LINE_HEIGHT));const ctaY=1070;const ctaX=SAFE_HORIZONTAL;const ctaW=CONTENT_WIDTH;const ctaText='Baca Selengkapnya di berita-auto.vercel.app';
 const categoryTextWidth=Math.max(1,category.length*CATEGORY_FONT*0.53);const categoryWidth=Math.max(118,Math.min(CONTENT_WIDTH,Math.ceil(categoryTextWidth+CATEGORY_PAD_X*2)));const categoryHeight=CATEGORY_FONT+CATEGORY_PAD_Y*2+2;const categoryX=CANVAS_WIDTH-SAFE_HORIZONTAL-categoryWidth;const categoryY=SAFE_TOP;const categoryCenterX=categoryX+categoryWidth/2;const categoryCenterY=categoryY+categoryHeight/2;
 const imageLayer=image?`<image href="${image}" x="0" y="0" width="${CANVAS_WIDTH}" height="900" preserveAspectRatio="xMidYMid slice" opacity="${isCover?'0.98':'0.34'}"/>`:'';
 const fallbackVisual=`<rect x="0" y="0" width="${CANVAS_WIDTH}" height="900" fill="${navy2}"/><circle cx="850" cy="280" r="300" fill="${accent}" fill-opacity=".12"/><circle cx="230" cy="650" r="420" fill="${accent}" fill-opacity=".045"/><path d="M0 700 C260 580 480 840 760 690 C900 615 980 580 1080 600 L1080 900 L0 900 Z" fill="${accent}" fill-opacity=".055"/>`;
 const gradient=`<linearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${navy}" stop-opacity=".12"/><stop offset=".40" stop-color="${navy}" stop-opacity=".22"/><stop offset=".72" stop-color="${navy}" stop-opacity=".74"/><stop offset="1" stop-color="${navy}" stop-opacity="1"/></linearGradient><linearGradient id="baseFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${navy}" stop-opacity="0"/><stop offset=".42" stop-color="${navy}" stop-opacity=".28"/><stop offset="1" stop-color="${navy}" stop-opacity="1"/></linearGradient>`;
 const header=`<g><rect x="${SAFE_HORIZONTAL}" y="${SAFE_TOP+2}" width="56" height="42" rx="11" fill="${accent}" fill-opacity=".98"/><text x="${SAFE_HORIZONTAL+28}" y="${SAFE_TOP+31}" text-anchor="middle" fill="${navy}" font-family="Noto Sans" font-size="24" font-weight="900">BA</text><text x="${SAFE_HORIZONTAL+72}" y="${SAFE_TOP+30}" fill="${white}" font-family="Noto Sans" font-size="25" font-weight="900" letter-spacing=".2">BERITA AUTO</text><rect x="${categoryX}" y="${categoryY}" width="${categoryWidth}" height="${categoryHeight}" rx="${categoryHeight/2}" fill="${accent}" stroke="#d9ffad" stroke-opacity=".28" stroke-width="1"/><text x="${categoryCenterX}" y="${categoryCenterY}" text-anchor="middle" dominant-baseline="middle" fill="${navy}" font-family="Noto Sans" font-size="${CATEGORY_FONT}" font-weight="900">${esc(category)}</text></g>`;
 const indicatorY=205;const indicatorText=`${slide} / ${slideCount}`;const indicatorW=112;const indicatorH=48;const indicator=`<g><rect x="${SAFE_HORIZONTAL}" y="${indicatorY}" width="${indicatorW}" height="${indicatorH}" rx="24" fill="${navy}" fill-opacity=".62" stroke="#d9eef8" stroke-opacity=".65" stroke-width="1.5"/><text x="${SAFE_HORIZONTAL+indicatorW/2}" y="${indicatorY+31}" text-anchor="middle" fill="${accent}" font-family="Noto Sans" font-size="20" font-weight="900">${indicatorText}</text></g>`;
 const titleSvg=`<text x="${SAFE_HORIZONTAL}" y="${titleY}" fill="${white}" font-family="Noto Sans" font-size="${headline.fontSize}" font-weight="900" letter-spacing="-1.1">${tspans(headline.lines,SAFE_HORIZONTAL,headline.lineHeight,HEADLINE_MAX_WIDTH,headline.fontSize)}</text>`;
 const panel=`<rect x="${SAFE_HORIZONTAL}" y="${panelY}" width="${CONTENT_WIDTH}" height="${panelHeight}" rx="28" fill="${navy2}" fill-opacity=".86" stroke="#b7d6e6" stroke-opacity=".20" stroke-width="1.5"/><rect x="${SAFE_HORIZONTAL}" y="${panelY}" width="6" height="${panelHeight}" rx="3" fill="${accent}"/>`;
 const bodyY=panelY+56;const bodySvg=`<text x="${SAFE_HORIZONTAL+CONTENT_INSET}" y="${bodyY}" fill="${bodyColor}" font-family="Noto Sans" font-size="${BODY_FONT}" font-weight="500">${tspans(bodyLines,SAFE_HORIZONTAL+CONTENT_INSET,BODY_LINE_HEIGHT,CONTENT_WIDTH-(CONTENT_INSET*2),BODY_FONT)}</text>`;
 const sectionLabel=`<text x="${SAFE_HORIZONTAL+CONTENT_INSET}" y="${panelY+32}" fill="${accent}" font-family="Noto Sans" font-size="15" font-weight="900" letter-spacing="1.6">${esc(isCover?'RINGKASAN':'POIN PENTING')}</text>`;
 const cta=`<g><rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="${CTA_HEIGHT}" rx="${CTA_HEIGHT/2}" fill="${navy2}" fill-opacity=".96" stroke="#c7e7d6" stroke-opacity=".30" stroke-width="1.5"/><circle cx="${ctaX+38}" cy="${ctaY+CTA_HEIGHT/2}" r="23" fill="${accent}"/><circle cx="${ctaX+38}" cy="${ctaY+CTA_HEIGHT/2}" r="10" fill="none" stroke="${navy}" stroke-width="2"/><path d="M${ctaX+28} ${ctaY+CTA_HEIGHT/2}h20 M${ctaX+38} ${ctaY+CTA_HEIGHT/2-10}v20" stroke="${navy}" stroke-width="2" stroke-linecap="round"/><text x="${ctaX+76}" y="${ctaY+31}" fill="${muted}" font-family="Noto Sans" font-size="16" font-weight="700">Baca Selengkapnya di</text><text x="${ctaX+76}" y="${ctaY+55}" fill="${accent}" font-family="Noto Sans" font-size="21" font-weight="900">berita-auto.vercel.app</text><circle cx="${ctaX+ctaW-40}" cy="${ctaY+CTA_HEIGHT/2}" r="23" fill="${accent}"/><path d="M${ctaX+ctaW-49} ${ctaY+CTA_HEIGHT/2}h18 M${ctaX+ctaW-38} ${ctaY+CTA_HEIGHT/2-9}l9 9-9 9" stroke="${navy}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
 const footer=`<text x="${SAFE_HORIZONTAL}" y="1285" fill="#88a3b2" font-family="Noto Sans" font-size="16" font-weight="700">${esc(source)}</text><text x="${CANVAS_WIDTH-SAFE_HORIZONTAL}" y="1285" text-anchor="end" fill="${accent}" font-family="Noto Sans" font-size="22" font-weight="900">BERITA AUTO</text>`;
 const dots=Array.from({length:Math.min(slideCount,6)},(_,index)=>{const active=index===slide-1;return`<circle cx="${SAFE_HORIZONTAL+index*18}" cy="1315" r="4" fill="${active?accent:'#55717f'}"/>`;}).join('');
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"><defs>${gradient}</defs><rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="${navy}"/>${imageLayer||fallbackVisual}<rect x="0" y="0" width="${CANVAS_WIDTH}" height="900" fill="url(#photoFade)"/><rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#baseFade)"/>${header}${indicator}${titleSvg}${panel}${sectionLabel}${bodySvg}${cta}${footer}<g>${dots}</g></svg>`;
}

export function normalizeSocialArticle(article={}){const source=article&&typeof article==='object'?article:{};return{...source,id:text(source.id),title:text(source.title)||'Berita terbaru',summary:text(source.summary||source.excerpt),excerpt:text(source.excerpt||source.summary),content:text(source.content||source.body||source.text),body:text(source.body),category:text(source.category)||'Berita',publisher:text(source.publisher||source.sourceName)||'Sumber publik',sourceName:text(source.sourceName||source.publisher)||'Sumber publik',sourceUrl:text(source.sourceUrl||source.source||source.originalUrl),canonicalUrl:text(source.canonicalUrl),imageUrl:text(source.imageUrl),topics:arr(source.topics),keywords:arr(source.keywords),entities:arr(source.entities),paragraphs:arr(source.paragraphs),slides:arr(source.slides)};}

export async function GET(request,{params}){const started=Date.now();const {articleId}=await params;const raw=(await readArticles()).find(item=>item.id===articleId);if(!raw)return new Response('Not found',{status:404});const article=normalizeSocialArticle(raw);const url=new URL(request.url);const slide=Math.max(1,Number(url.searchParams.get('slide')||1));const slides=buildSocialSlides(article);if(slide>slides.length)return new Response('Slide not found',{status:404});const html=await fetchArticleHtml(article);const resolved=await resolveImages(article,html);const imageDataUrls=[];for(const item of resolved){const data=await imageData(item.url);if(data)imageDataUrls.push(data);if(imageDataUrls.length>=2)break;}const renderStarted=Date.now();const svg=renderSvg(article,slide,slides,imageDataUrls);const jpeg=await sharp(Buffer.from(svg)).jpeg({quality:88,mozjpeg:true}).toBuffer();console.log(`[social-card] articleId=${articleId} slide=${slide} image=${resolved[0]?.provenance||'FALLBACK'} image2=${resolved[1]?.provenance||'NONE'} slides=${slides.length} renderMs=${Date.now()-renderStarted} totalMs=${Date.now()-started}`);return new Response(jpeg,{status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300, s-maxage=300, stale-while-revalidate=600','Content-Length':String(jpeg.length),'X-Social-Card-Render':'valid','X-Social-Card-Slide-Count':String(slides.length),'X-Social-Card-Image-Provenance':String(resolved[0]?.provenance||'FALLBACK'),'X-Social-Card-Image-2-Provenance':String(resolved[1]?.provenance||'NONE'),'X-Social-Card-Font-Source':'bundled-ttf'}});}
