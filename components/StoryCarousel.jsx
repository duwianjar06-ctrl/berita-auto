'use client';
import {useRef} from 'react';
import {articlePath} from '../lib/article-url.js';
import './story-carousel.css';

export default function StoryCarousel({articles=[]}){
  const ref=useRef(null);
  const move=(direction)=>ref.current?.scrollBy({left:direction*360,behavior:'smooth'});
  if(!articles.length)return null;
  return <section className="story-carousel" aria-label="Sorotan berita"><div className="story-carousel-head"><div><span className="category-eyebrow">SOROTAN</span><h2>Berita Pilihan</h2></div><div className="story-carousel-controls"><button type="button" onClick={()=>move(-1)} aria-label="Berita sebelumnya">←</button><button type="button" onClick={()=>move(1)} aria-label="Berita berikutnya">→</button></div></div><div className="story-carousel-track" ref={ref} tabIndex="0">{articles.slice(0,10).map(article=><a className="story-carousel-card" key={article.id} href={articlePath(article)}><div className="story-carousel-image">{article.imageUrl?<img src={article.imageUrl} alt="" width="500" height="330" loading="lazy"/>:<span>BA</span>}</div><div><span className="category-chip">{article.category||'Nasional'}</span><h3>{article.title}</h3><small>{article.sourceName||'Sumber publik'}</small></div></a>)}</div></section>;
}
