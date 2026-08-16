import {categories} from '../lib/categories.js';
import {readArticles} from '../lib/storage.js';
import CategoryNav from './CategoryNav.jsx';

async function getPublishedCategoryCounts(){
  const counts=Object.fromEntries(categories.map(category=>[category,0]));
  try{
    const articles=await readArticles();
    for(const article of articles){
      if(!article?.sitePublishedAt&&!article?.publishedAt)continue;
      const category=categories.find(name=>name.toLowerCase()===String(article.category||'').trim().toLowerCase());
      if(category)counts[category]+=1;
    }
  }catch{
    // Keep the public header usable if the aggregate source is temporarily unavailable.
  }
  return counts;
}

export default async function Header({latestTitle=''}){
  const categoryCounts=await getPublishedCategoryCounts();
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
