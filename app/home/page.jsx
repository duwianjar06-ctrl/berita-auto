import Header from '../../components/Header.jsx';
import NewsCard from '../../components/NewsCard.jsx';
import Footer from '../../components/Footer.jsx';
import AdSlot from '../../components/AdSlot.jsx';
import {readArticles} from '../../lib/storage.js';
import {categories} from '../../lib/categories.js';
import './editorial.css';

export const dynamic='force-dynamic';
const siteUrl='https://berita-auto.vercel.app';

function byCategory(items,name){return items.filter(a=>(a.category||'').toLowerCase()===name.toLowerCase());}

export default async function EditorialHome(){
  const articles=await readArticles();
  const featured=articles[0];
  const secondary=articles.slice(1,3);
  const categorySections=categories.map(name=>({name,items:byCategory(articles,name)})).filter(x=>x.items.length).slice(0,8);
  const latestSide=articles.slice(0,5);
  const schema={'@context':'https://schema.org','@graph':[{'@type':'WebSite',name:'Berita Auto',url:siteUrl},{'@type':'Organization',name:'Berita Auto',url:siteUrl}]};
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
    <Header latestTitle={featured?.title||'Sistem sedang mencari berita terbaru…'}/>
    <main className="page container">
      <section className="intro fade-up"><span>BERITA HARI INI</span><h1>Berita terbaru, dirangkum otomatis.</h1><p>Informasi terbaru dari sumber publik, diperbarui sekitar setiap lima menit.</p></section>
      <AdSlot variant="leaderboard" placement="top" />
      {featured?<section className="hero soft-scale"><div><NewsCard article={featured} featured/></div><div className="side">{secondary.map((a,i)=><div key={a.id} style={{animationDelay:`${(i+1)*90}ms`}} className="fade-up"><NewsCard article={a}/></div>)}<AdSlot variant="rectangle" placement="sidebar"/></div></section>:<section className="empty"><h2>Belum ada berita terbaru</h2><p>Sistem sedang memeriksa sumber berita dan akan memperbarui halaman secara otomatis.</p></section>}
      <section className="section"><div className="title"><div><span className="category-eyebrow">TERBARU</span><h2>Berita Terbaru</h2></div><a href="/kategori/nasional">Lihat semua →</a></div><div className="news-grid">{articles.slice(3,12).map(a=><NewsCard key={a.id} article={a}/>)}</div></section>
      <AdSlot variant="leaderboard" placement="infeed" />
      {categorySections.map((section,index)=><section className="category-section" key={section.name}><div className="title"><div><span className="category-eyebrow">KATEGORI</span><h2>{section.name}</h2></div><a href={`/kategori/${section.name.toLowerCase()}`}>Lihat semua →</a></div><div className="category-feature-grid"><NewsCard article={section.items[0]} featured/><div className="mini-list">{section.items.slice(1,4).map(a=><a className="mini-item" key={a.id} href={`/berita/${a.slug||a.id}`}><div>{a.imageUrl?<img src={a.imageUrl} alt={a.title} width="300" height="200" loading="lazy"/>:<div className="image-fallback"><span>BA</span></div>}</div><div><span className="category-chip">{section.name}</span><h3>{a.title}</h3><small>{a.sourceName||'Sumber publik'}</small></div></a>)}</div></div>{index===2&&<AdSlot variant="leaderboard" placement="infeed"/>}</section>)}
      <section className="section"><div className="title"><div><span className="category-eyebrow">JELAJAHI</span><h2>Lebih Banyak Kategori</h2></div></div><div className="categories">{categories.map(c=><a href={`/kategori/${c.toLowerCase()}`} key={c}>{c}<b>→</b></a>)}</div></section>
      <AdSlot variant="leaderboard" placement="footer" />
    </main>
    <Footer/>
  </>;
}
