import {readArticles} from '../../../lib/storage.js';
import {categories} from '../../../lib/categories.js';

const base='https://berita-auto.vercel.app';
const descriptions={nasional:'Berita Nasional terkini dan informasi terbaru Indonesia.',internasional:'Berita Internasional terkini dan perkembangan terbaru dunia.',ekonomi:'Berita ekonomi terkini Indonesia dan perkembangan perekonomian terbaru.',bisnis:'Berita bisnis terkini Indonesia dan informasi dunia usaha terbaru.',teknologi:'Berita teknologi terkini Indonesia dan perkembangan teknologi terbaru.',olahraga:'Berita olahraga terkini Indonesia dan kabar olahraga terbaru.',hiburan:'Berita hiburan terkini Indonesia dan kabar artis serta budaya populer terbaru.',lifestyle:'Berita lifestyle terkini Indonesia tentang gaya hidup, kesehatan, dan tren terbaru.',otomotif:'Berita otomotif terkini Indonesia tentang mobil, motor, dan perkembangan industri kendaraan.',sains:'Berita sains terkini Indonesia dan perkembangan ilmu pengetahuan terbaru.',politik:'Berita politik terkini Indonesia dan perkembangan politik nasional terbaru.',daerah:'Berita daerah terkini Indonesia dari berbagai wilayah.'};

export async function generateMetadata({params}){
  const {slug}=await params;
  const key=slug.toLowerCase();
  const label=categories.find(x=>x.toLowerCase()===key)||slug;
  return {title:`Berita ${label} Terkini`,description:descriptions[key]||`Berita ${label} terkini dan informasi terbaru Indonesia.`,alternates:{canonical:`${base}/kategori/${encodeURIComponent(key)}`},openGraph:{type:'website',url:`${base}/kategori/${encodeURIComponent(key)}`,title:`Berita ${label} Terkini | Berita Auto`,description:descriptions[key]||`Berita ${label} terkini dan informasi terbaru Indonesia.`,siteName:'Berita Auto',locale:'id_ID'},twitter:{card:'summary_large_image',title:`Berita ${label} Terkini | Berita Auto`,description:descriptions[key]||`Berita ${label} terkini dan informasi terbaru Indonesia.`}};
}

export const dynamic='force-dynamic';

export default async function CategoryPage({params}){
  const {slug}=await params;
  const wanted=slug.replace(/-/g,' ').toLowerCase();
  const items=(await readArticles()).filter(x=>(x.category||'').toLowerCase()===wanted);
  return <main className="container"><p><a href="/">Beranda</a></p><h1>Berita {slug}</h1><p>{descriptions[wanted]||`Berita ${slug} terkini dan informasi terbaru Indonesia.`}</p><section className="grid">{items.map(a=><article key={a.id}><h3><a href={'/berita/'+a.id}>{a.title}</a></h3>{a.imageUrl&&<img src={a.imageUrl} alt={a.title} width="800" height="533" loading="lazy"/>}<p>{a.excerpt||a.summary||''}</p></article>)}</section></main>
}
