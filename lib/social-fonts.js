import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

export const SOCIAL_FONT_DIR=path.join(process.cwd(),'assets','fonts');
export const SOCIAL_REGULAR_FONT=path.join(SOCIAL_FONT_DIR,'NotoSans-Regular.ttf');
export const SOCIAL_BOLD_FONT=path.join(SOCIAL_FONT_DIR,'NotoSans-Bold.ttf');
const FONTCONFIG_DIR=path.join('/tmp','berita-auto-fontconfig');
const RUNTIME_FONTCONFIG=path.join(FONTCONFIG_DIR,'fonts.conf');
function ensure(){fs.mkdirSync(FONTCONFIG_DIR,{recursive:true});const xml=`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${SOCIAL_FONT_DIR}</dir><dir>/usr/share/fonts</dir><dir>/usr/local/share/fonts</dir><dir>/opt/fonts</dir><cachedir>/tmp/fontconfig</cachedir></fontconfig>`;fs.writeFileSync(RUNTIME_FONTCONFIG,xml,'utf8');process.env.FONTCONFIG_FILE=RUNTIME_FONTCONFIG;process.env.FONTCONFIG_PATH=FONTCONFIG_DIR;}
function charsetSet(value){const set=new Set();for(const token of String(value||'').trim().split(/\s+/)){const [a,b]=token.split('-');const start=parseInt(a,16);const end=b?parseInt(b,16):start;if(!Number.isFinite(start)||!Number.isFinite(end))continue;for(let cp=start;cp<=end&&cp-start<4096;cp++)set.add(cp);}return set;}
export function getSocialFontDiagnostics(sampleText=''){
 const regular=fs.existsSync(SOCIAL_REGULAR_FONT);const bold=fs.existsSync(SOCIAL_BOLD_FONT);if(!regular||!bold)return{requestedFamily:'Noto Sans',resolvedFamily:null,regular:regular?'FOUND':'MISSING',bold:bold?'FOUND':'MISSING',fontSource:'bundled-ttf',fontconfig:'FAIL',fontHealth:'FAIL',unsupportedGlyphs:null,tofuStatus:'UNKNOWN',regularFile:'NotoSans-Regular.ttf',boldFile:'NotoSans-Bold.ttf'};
 let resolvedFamily=null,resolvedFile=null,charset=null,fontconfig='CONFIGURED';try{ensure();resolvedFamily=execFileSync('fc-match',['-f','%{family}','Noto Sans'],{env:process.env,timeout:1500}).toString().trim()||null;resolvedFile=execFileSync('fc-match',['-f','%{file}','Noto Sans'],{env:process.env,timeout:1500}).toString().trim()||null;const raw=execFileSync('fc-query',['-f','%{charset}',SOCIAL_REGULAR_FONT],{env:process.env,timeout:1500}).toString();charset=charsetSet(raw);}catch{fontconfig='UNKNOWN';}
 const unsupported=charset?Array.from(new Set(Array.from(String(sampleText||'')).map(ch=>ch.codePointAt(0)).filter(cp=>cp>31&&!charset.has(cp)))):null;const resolvedOk=resolvedFamily?resolvedFamily.toLowerCase().includes('noto sans'):null;const fontHealth=fontconfig==='UNKNOWN'?'WARNING':resolvedOk===false?'WARNING':'PASS';return{requestedFamily:'Noto Sans',resolvedFamily,regular:'FOUND',bold:'FOUND',fontSource:'bundled-ttf',fontconfig,fontHealth,unsupportedGlyphs:unsupported?.length??null,tofuStatus:unsupported?unsupported.length?'WARNING':'VERIFIED CLEAN':'UNKNOWN',resolvedFile:resolvedFile?path.basename(resolvedFile):null,regularFile:'NotoSans-Regular.ttf',boldFile:'NotoSans-Bold.ttf'};
}
