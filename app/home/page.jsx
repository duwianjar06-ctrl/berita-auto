import Header from '../../components/Header.jsx';
import NewsCard from '../../components/NewsCard.jsx';
import Footer from '../../components/Footer.jsx';
import {readArticles} from '../../lib/storage.js';
import {categories} from '../../lib/categories.js';
import './editorial.css';

export const dynamic='force-dynamic';

export default async function EditorialHome(){
  const articles=await readArticles();
  const featured=articles[0];
  const secondary=articles.slice(1,3);
  return <>
    <Header latestTitle={featured?.title||'Sistem sedang mencari berita terbaru…'}/>
    <main className="page container">
      <section className="intro"><span>BERITA HARI INI</span><h1>Berita terbaru, dirangkum otomatis.</h1><p>Informasi terbaru dari sumber publik, diperbarui setiap lima menit.</p></section>
      {featured?<section className="hero"><NewsCard article={featured} featured/><div className="side">{secondary.map(a=><NewsCard key={a.id} article={a}/>)}</div></section>:<section className="empty"><h2>Belum ada berita terbaru</h2><p>Sistem sedang memeriksa sumber berita dan akan memperbarui halaman secara otomatis.</p></section>}
      <section className="section"><div className="title"><h2>Berita Terbaru</h2><a href="/kategori/nasional">Lihat semua →</a></div><div className="news-grid">{articles.slice(3,12).map(a=><NewsCard key={a.id} article={a}/>)}</div></section>
      <section className="section"><div className="title"><h2>Kategori</h2></div><div className="categories">{categories.map(c=><a href={'/kategori/'+c.toLowerCase()} key={c}>{c}<b>→</b></a>)}</div></section>
    </main>
    <Footer/>
  </>
}
