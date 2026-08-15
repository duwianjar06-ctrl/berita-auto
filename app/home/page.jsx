import Header from '../../components/Header.jsx';
import NewsCard from '../../components/NewsCard.jsx';
import Footer from '../../components/Footer.jsx';
import AdSlot from '../../components/AdSlot.jsx';
import StoryCarousel from '../../components/StoryCarousel.jsx';
import {readArticles} from '../../lib/storage.js';
import {getPopularArticles,analyticsConfigured} from '../../lib/analytics.js';
import {articlePath} from '../../lib/article-url.js';
import {categories} from '../../lib/categories.js';
import {NEWS_SOURCES} from '../../lib/sources.js';
import './editorial.css';
import './intro.css';

export const dynamic='force-dynamic';
const FOREIGN_SOURCE_IDS=new Set(NEWS_SOURCES.filter(source=>source.language!=='id').map(source=>source.id));
function byCategory(items,name){return items.filter(a=>(a.category||'').toLowerCase()===name.toLowerCase());}
function publicArticle(a){const language=String(a.language||'id').toLowerCase();const status=String(a.translationStatus||'translated').toLowerCase();const sourceId=String(a.sourceId||'');return status==='translated'||(language==='id'&&!FOREIGN_SOURCE_IDS.has(sourceId));}
export default async function EditorialHome(){
 const articles=await readArticles();
 const visible=articles.filter(publicArticle);
 const featured=visible[0];
 const secondary=visible.slice(1,4);
 const categorySections=categories.map(name=>({name,items:byCategory(visible,name)})).filter(x=>x.items.length>=2).slice(0,6);
 const compact=visible.slice(7,17);
 const popularRaw=analyticsConfigured()?await getPopularArticles(visible,7,6):[];
 const popular=popularRaw.filter(publicArticle);
 const sourceCount=new Set(visible.map(a=>String(a.sourceName||'').trim()).filter(Boolean)).size;
 const schema={'@context':'https://schema.org','@graph':[{'@type':'WebSite',name:'Berita Auto',url:'https://berita-auto.vercel.app'},{'@type':'Organization',name:'Berita Auto',url:'https://berita-auto.vercel.app'}]};
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><Header latestTitle={featured?.title||'Sistem sedang mencari berita terbaru…'}/><main className="page container">
  <section className="editorial-masthead" aria-labelledby="berita-hari-ini-title"><div><span className="intro-badge"><i aria-hidden="true"/>BERITA HARI INI</span><h1 id="berita-hari-ini-title">Berita penting, dirangkum dalam satu tempat.</h1></div><p>{sourceCount||'Beragam'} sumber publik tepercaya · {categories.length} kategori · diperbarui berkala.</p></section>
  <AdSlot variant="leaderboard" placement="homepage_top"/>
  {featured?<section className="hero soft-scale" aria-label="Berita utama"><div><NewsCard article={featured} featured/></div><div className="side">{secondary.map((a,i)=><div key={a.id} style={{animationDelay:`${(i+1)*70}ms`}} className="fade-up"><NewsCard article={a}/></div>)}<AdSlot variant="rectangle" placement="homepage_sidebar"/></div></section>:<section className="empty"><h2>Belum ada berita terbaru</h2><p>Sistem sedang memeriksa sumber berita.</p></section>}
  {visible.length>4&&<StoryCarousel articles={visible.slice(0,8)}/>} 
  <section className="section latest-section"><div className="title"><div><span className="category-eyebrow">TERBARU</span><h2>Berita Terbaru</h2></div><a href="/kategori/nasional">Lihat semua →</a></div><div className="news-grid compact-grid">{visible.slice(0,6).map(a=><NewsCard key={a.id} article={a}/>)}</div></section>
  {popular.length>0&&<><AdSlot variant="leaderboard" placement="homepage_after_featured"/><section className="section"><div className="title"><div><span className="category-eyebrow">POPULER 7 HARI</span><h2>Paling Banyak Dilihat</h2></div></div><div className="popular-list">{popular.map((a,i)=><a className="popular-item" key={a.id} href={articlePath(a)}><b>{String(i+1).padStart(2,'0')}</b><span><strong>{a.title}</strong><small>{a.category||'Berita'} · {a.sourceName||'Sumber publik'}{a.views!=null?` · ${a.views} views`:''}</small></span></a>)}</div></section></>}
  {compact.length>0&&<><AdSlot variant="leaderboard" placement="homepage_feed_1"/><section className="section"><div className="title"><div><span className="category-eyebrow">JELAJAH</span><h2>Berita Lainnya</h2></div></div><div className="compact-news-list">{compact.map(a=><a className="compact-news-item" key={a.id} href={articlePath(a)}>{a.imageUrl?<img src={a.imageUrl} alt="" width="220" height="140" loading="lazy"/>:<div className="image-fallback"><span>BA</span></div>}<div><span className="category-chip">{a.category||'Berita'}</span><h3>{a.title}</h3><small>{a.sourceName||'Sumber publik'}</small></div></a>)}</div></section></>}
  {categorySections.map((section,index)=><section className="category-section" key={section.name}><div className="title"><div><span className="category-eyebrow">KATEGORI</span><h2>{section.name}</h2></div><a href={`/kategori/${section.name.toLowerCase()}`}>Lihat semua →</a></div><div className="category-feature-grid"><NewsCard article={section.items[0]} featured/><div className="mini-list">{section.items.slice(1,4).map(a=><a className="mini-item" key={a.id} href={articlePath(a)}><div>{a.imageUrl?<img src={a.imageUrl} alt="" width="300" height="200" loading="lazy"/>:<div className="image-fallback"><span>BA</span></div>}</div><div><span className="category-chip">{section.name}</span><h3>{a.title}</h3><small>{a.sourceName||'Sumber publik'}</small></div></a>)}</div></div>{index===1&&<AdSlot variant="leaderboard" placement="homepage_category_1"/>}</section>)}
  <section className="section"><div className="title"><div><span className="category-eyebrow">JELAJAHI</span><h2>Lebih Banyak Kategori</h2></div></div><div className="categories">{categories.map(c=><a href={`/kategori/${c.toLowerCase()}`} key={c}>{c}<b>→</b></a>)}</div></section>
  <AdSlot variant="footer" placement="homepage_bottom"/>
 </main><Footer/></>;
}
