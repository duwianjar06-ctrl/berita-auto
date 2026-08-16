import {categories} from '../lib/categories.js';
import {readPublicArticles} from '../lib/public-data.js';
import CategoryNav from './CategoryNav.jsx';

function getPublishedCategoryCounts(items=[]){
  const counts=Object.fromEntries(categories.map(category=>[category,0]));
  for(const article of items){
    if(!article?.sitePublishedAt&&!article?.publishedAt)continue;
    const category=categories.find(name=>name.toLowerCase()===String(article.category||'').trim().toLowerCase());
    if(category)counts[category]+=1;
  }
  return counts;
}

export default async function Header({latestTitle='',counts=null}){
  const categoryCounts=counts||getPublishedCategoryCounts(await readPublicArticles());
  return <>
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="/"><span className="brand-mark">BA</span><span>Berita <b>Auto</b></span></a>
        <div className="live-badge"><i/> LIVE · UPDATE OTOMATIS</div>
        <form className="search-form" action="/cari">
          <label className="sr-only" htmlFor="site-search">Cari berita</label>
          <input id="site-search" name="q" placeholder="Cari berita…"/>
          <button type="submit" aria-label="Cari">⌕</button>
        </form>
      </div>
      <CategoryNav counts={categoryCounts}/>
    </header>
    {latestTitle&&<div className="latest-bar"><div className="container latest-inner"><strong>BERITA TERKINI</strong><a href="/">{latestTitle}</a></div></div>}
  </>;
}
