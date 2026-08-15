const clean=(value='')=>String(value).replace(/\s+/g,' ').trim();
const words=(value='')=>clean(value).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,' ').split(/\s+/).filter(w=>w.length>2);
const unique=(items)=>[...new Set(items.filter(Boolean))];
const CATEGORY_RULES=[
  ['Olahraga',['sepak bola','liga','gol','pemain','atlet','olahraga','pertandingan','tenis','basket','balap']],
  ['Teknologi',['teknologi','ai','artificial intelligence','startup','chip','smartphone','aplikasi','digital','siber','internet']],
  ['Ekonomi',['ekonomi','rupiah','saham','inflasi','bank','investasi','pasar','bisnis','pajak','ekspor','impor']],
  ['Bencana',['gempa','banjir','longsor','erupsi','gunung api','tsunami','cuaca ekstrem','bencana','kebakaran']],
  ['Kriminal',['polisi','kriminal','tersangka','penangkapan','korban','kejahatan','kasus','penembakan','pencurian']],
  ['Politik',['presiden','pemilu','partai','dpr','politik','menteri','kebijakan','pemerintah','pilkada']],
  ['Internasional',['amerika','china','tiongkok','jepang','rusia','ukraina','israel','palestina','dunia','internasional','negara']],
  ['Kesehatan',['kesehatan','dokter','rumah sakit','penyakit','vaksin','obat','pasien','kesehatan masyarakat']],
  ['Sains',['sains','ilmuwan','penelitian','riset','antariksa','nasa','astronomi','penemuan']],
];
export function socialVisualProfile(article={}){
  const text=clean([article.title,article.summary,article.excerpt,article.content,article.body,article.category].filter(Boolean).join(' '));
  const lower=text.toLowerCase();
  const matched=CATEGORY_RULES.find(([,terms])=>terms.some(term=>lower.includes(term)));
  const category=matched?.[0]||clean(article.category)||'Berita';
  const terms=matched?.[1]||[];
  const matchedTerms=unique(terms.filter(term=>lower.includes(term))).slice(0,3);
  const named=unique((text.match(/\b[A-ZÀ-Ý][\p{L}.-]{2,}(?:\s+[A-ZÀ-Ý][\p{L}.-]{2,}){0,2}/gu)||[]).map(clean)).filter(x=>!['Berita Auto','Berita Terkini','Sumber'].includes(x)).slice(0,3);
  const fallback=unique(words(text).filter(w=>w.length>4)).slice(0,4);
  const keywords=unique([...matchedTerms,...named,...fallback]).slice(0,4);
  const styles={Olahraga:{accent:'#ef4444',icon:'SPORT'},Teknologi:{accent:'#06b6d4',icon:'TECH'},Ekonomi:{accent:'#16a34a',icon:'ECONOMY'},Bencana:{accent:'#f97316',icon:'ALERT'},Kriminal:{accent:'#7c3aed',icon:'SAFETY'},Politik:{accent:'#2563eb',icon:'POLITIK'},Internasional:{accent:'#0ea5e9',icon:'WORLD'},Kesehatan:{accent:'#e11d48',icon:'HEALTH'},Sains:{accent:'#8b5cf6',icon:'SCIENCE'},Berita:{accent:'#1d4ed8',icon:'NEWS'}};
  return {category,keywords,style:styles[category]||styles.Berita};
}
const trim=(value,max)=>clean(value).slice(0,max).trim();
function splitText(text,max){const value=clean(text);if(value.length<=max)return [value];const parts=[];let rest=value;while(rest.length){let cut=rest.slice(0,max).lastIndexOf(' ');if(cut<Math.floor(max*.65))cut=max;parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();if(parts.length>=3)break;}return parts;}
export function buildSocialSlides(article={}){
  const title=trim(article.title||'Berita terbaru',180);
  const summary=trim(article.excerpt||article.summary||'',320);
  const body=clean(article.content||article.body||article.text||'');
  const continuation=body.replace(summary,'').trim()||body;
  const chunks=splitText(continuation,620);
  const needsSecond=summary.length>280||chunks.some(Boolean)&&((summary+' '+continuation).length>620);
  const slide1={title,summary:trim(summary,280),number:1};
  if(!needsSecond)return [slide1];
  const secondText=trim((summary.length>280?summary.slice(280)+' ':'')+chunks.join(' '),760);
  return [slide1,{title:'Poin penting',summary:secondText,number:2}];
}
export function socialCardText(article,slide=1){const slides=buildSocialSlides(article);return slides[Math.max(0,Math.min(slides.length-1,Number(slide)-1))];}
