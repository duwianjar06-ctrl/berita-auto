import Header from '../../components/Header.jsx';
import Footer from '../../components/Footer.jsx';
import NewsCard from '../../components/NewsCard.jsx';
import {readArticles} from '../../lib/storage.js';

export const dynamic='force-dynamic';
export const metadata={title:'Cari Berita | Berita Auto',robots:{index:false,follow:true}};

function relevance(article,q){
  const title=String(article.title||'').toLowerCase();
  const excerpt=String(article.excerpt||article.summary||'').toLowerCase();
  const content=String(article.content||'').toLowerCase();
  const category=String(article.category||'').toLowerCase();
  const source=String(article.sourceName||'').toLowerCase();
  if(title===q)return 100;
  let value=0;
  if(title.includes(q))value+=80;
  if(excerpt.includes(q))value+=60;
  if(content.includes(q))value+=30;
  if(category.includes(q)||source.includes(q))value+=20;
  return value;
}

export default async function SearchPage({searchParams}){
  const params=await searchParams;
  const q=String(params?.q||'').trim().toLowerCase();
  const requestedPage=Math.max(1,Number(params?.page||1)||1);
  const all=await readArticles();
  const matches=q
    ? all.map(article=>({...article,_score:relevance(article,q)})).filter(article=>article._score>0).sort((a,b)=>b._score-a._score||String(b.sitePublishedAt||b.createdAt).localeCompare(String(a.sitePublishedAt||a.createdAt)))
    : [];
  const perPage=12;
  const pageCount=Math.max(1,Math.ceil(matches.length/perPage));
  const page=Math.min(requestedPage,pageCount);
  const visible=matches.slice((page-1)*perPage,page*perPage);
  return (
    <>
      <Header latestTitle={all[0]?.title||'Berita Auto'}/>
      <main className="page container search-page">
        <header className="category-heading">
          <span className="category-eyebrow">PENCARIAN</span>
          <h1>Cari Berita</h1>
          {q ? <p>Hasil pencarian untuk <strong>“{q}”</strong>.</p> : <p>Temukan berita yang sudah diterbitkan Berita Auto berdasarkan judul, ringkasan, isi, kategori, dan sumber.</p>}
        </header>
        {q && visible.length > 0 ? (
          <>
            <div className="news-grid">{visible.map(article=><NewsCard key={article.id} article={article}/>)}</div>
            {pageCount>1 && <nav className="search-pagination" aria-label="Paginasi hasil pencarian">{Array.from({length:pageCount},(_,index)=>index+1).map(number=><a key={number} className={number===page?'active':''} href={`/cari?q=${encodeURIComponent(q)}&page=${number}`}>{number}</a>)}</nav>}
          </>
        ) : (
          <section className="empty">
            <h2>{q?'Tidak ada berita ditemukan':'Mulai pencarian'}</h2>
            <p>{q?'Coba kata kunci lain yang lebih spesifik.':'Masukkan kata kunci pada kolom pencarian di header.'}</p>
          </section>
        )}
        <div className="search-guidance">Pencarian hanya mencakup artikel yang sudah dipublikasikan; iklan dan pending queue tidak ikut hasil.</div>
      </main>
      <Footer/>
    </>
  );
}
