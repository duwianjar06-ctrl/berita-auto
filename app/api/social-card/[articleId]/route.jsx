import {ImageResponse} from 'next/og';
import {readArticles} from '../../../../lib/storage.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const clip=(value,max)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
export async function GET(request,{params}){
  const {articleId}=await params;const article=(await readArticles()).find(item=>item.id===articleId);
  if(!article)return new Response('Not found',{status:404});
  const title=clip(article.title||'Berita terbaru',180);const excerpt=clip(article.excerpt||article.summary||'',260);const category=clip(article.category||'Berita',40);const publisher=clip(article.publisher||article.sourceName||'Sumber publik',70);
  const size=title.length>125?48:title.length>90?56:title.length>60?64:72;
  return new ImageResponse(<div style={{width:'1080px',height:'1350px',display:'flex',flexDirection:'column',padding:'76px',background:'linear-gradient(145deg,#07111f 0%,#102b4b 55%,#f0f4f8 55%,#f0f4f8 100%)',fontFamily:'Arial, Helvetica, sans-serif',color:'#fff'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{display:'flex',fontSize:'38px',fontWeight:800,letterSpacing:'1px'}}>BERITA AUTO</div><div style={{display:'flex',fontSize:'28px',fontWeight:700,padding:'12px 20px',borderRadius:'999px',background:'#fff',color:'#102b4b'}}>{category}</div></div><div style={{display:'flex',flexDirection:'column',marginTop:'180px',maxWidth:'930px'}}><div style={{display:'flex',fontSize:'26px',fontWeight:700,marginBottom:'26px',color:'#d9e8f7'}}>BERITA TERKINI</div><div style={{display:'flex',fontSize:`${size}px`,fontWeight:800,lineHeight:1.08,letterSpacing:'-1px'}}>{title}</div></div><div style={{display:'flex',flexDirection:'column',marginTop:'54px',padding:'30px 34px',borderRadius:'26px',background:'rgba(255,255,255,.94)',color:'#132238',maxWidth:'930px'}}><div style={{display:'flex',fontSize:'30px',lineHeight:1.3}}>{excerpt}</div><div style={{display:'flex',fontSize:'24px',fontWeight:700,marginTop:'28px'}}>Sumber: {publisher}</div></div><div style={{display:'flex',marginTop:'auto',justifyContent:'space-between',alignItems:'flex-end',color:'#102b4b'}}><div style={{display:'flex',fontSize:'26px',fontWeight:700}}>berita-auto.vercel.app</div><div style={{display:'flex',fontSize:'64px',fontWeight:900}}>BA</div></div></div>,{width:1080,height:1350});
}
