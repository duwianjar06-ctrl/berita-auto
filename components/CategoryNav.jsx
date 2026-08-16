'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {categorySlug,categories} from '../lib/categories.js';

function getVisibleCount(width){
  if(width>=1280)return 8;
  if(width>=1100)return 6;
  if(width>=981)return 4;
  return 0;
}

function isCategoryPath(pathname,category){
  return pathname===`/kategori/${categorySlug(category)}`;
}

export default function CategoryNav({counts={}}){
  const pathname=usePathname();
  const rootRef=useRef(null);
  const [open,setOpen]=useState(false);
  const [visibleCount,setVisibleCount]=useState(0);

  useEffect(()=>{
    const update=()=>setVisibleCount(getVisibleCount(window.innerWidth));
    update();
    window.addEventListener('resize',update);
    return()=>window.removeEventListener('resize',update);
  },[]);

  useEffect(()=>{
    if(!open)return undefined;
    const onPointerDown=(event)=>{
      if(rootRef.current&&!rootRef.current.contains(event.target))setOpen(false);
    };
    const onKeyDown=(event)=>{
      if(event.key==='Escape')setOpen(false);
    };
    document.addEventListener('pointerdown',onPointerDown);
    document.addEventListener('keydown',onKeyDown);
    return()=>{
      document.removeEventListener('pointerdown',onPointerDown);
      document.removeEventListener('keydown',onKeyDown);
    };
  },[open]);

  const ordered=useMemo(()=>categories.map((name,index)=>({
    name,
    count:Number.isFinite(Number(counts[name]))?Number(counts[name]):0,
    index,
  })).sort((a,b)=>b.count-a.count||a.index-b.index||a.name.localeCompare(b.name)),[counts]);
  const primary=ordered.slice(0,visibleCount);
  const overflow=ordered.slice(visibleCount);
  const activeOverflow=overflow.some(item=>isCategoryPath(pathname,item.name));

  const go=()=>setOpen(false);
  const categoryLink=(item,extra='')=><a className={`category-nav-link ${isCategoryPath(pathname,item.name)?'is-active ':''}${extra}`} href={`/kategori/${categorySlug(item.name)}`} onClick={go} aria-current={isCategoryPath(pathname,item.name)?'page':undefined}>{item.name}</a>;

  return <nav ref={rootRef} className="category-nav" aria-label="Kategori berita">
    <div className="category-nav-desktop">
      <a className={`category-nav-link home-link ${pathname==='/'?'is-active':''}`} href="/" onClick={go} aria-current={pathname==='/'?'page':undefined}>Beranda</a>
      {primary.map(item=>categoryLink(item))}
      {overflow.length>0&&<div className="category-nav-overflow">
        <button type="button" className={`category-nav-trigger ${activeOverflow?'is-active':''}`} aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
          Kategori Lainnya <span aria-hidden="true">▾</span>
        </button>
        {open&&<div className="category-nav-dropdown" role="menu">
          {overflow.map(item=><div key={item.name} role="none">{categoryLink(item,'category-nav-dropdown-link')}</div>)}
        </div>}
      </div>}
    </div>

    <div className="category-nav-mobile">
      <a className={`category-nav-link home-link ${pathname==='/'?'is-active':''}`} href="/" onClick={go} aria-current={pathname==='/'?'page':undefined}>Beranda</a>
      <button type="button" className={`category-nav-trigger ${activeOverflow||pathname.startsWith('/kategori/')?'is-active':''}`} aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
        Kategori <span aria-hidden="true">▾</span>
      </button>
      {open&&<div className="category-nav-mobile-panel" role="menu">
        {ordered.map(item=><div key={item.name} role="none">{categoryLink(item,'category-nav-dropdown-link')}</div>)}
      </div>}
    </div>

    <style>{`
      .category-nav{position:relative;border-top:1px solid rgba(255,255,255,.07);background:rgba(15,23,42,.96)}
      .category-nav-desktop{width:min(calc(100% - 32px),var(--container));margin-inline:auto;display:flex;align-items:center;gap:2px;min-width:0;overflow:visible}
      .category-nav-link,.category-nav-trigger{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:42px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:#cbd5e1;font-size:12px;font-weight:750;white-space:nowrap;text-decoration:none;transition:color .18s ease,background .18s ease}
      .category-nav-link:hover,.category-nav-trigger:hover{background:rgba(255,255,255,.07);color:#fff}
      .category-nav-link.is-active,.category-nav-trigger.is-active{color:#fff;background:rgba(249,115,22,.14)}
      .category-nav-link.is-active::after{content:"";position:absolute;left:10px;right:10px;bottom:3px;height:2px;border-radius:999px;background:var(--primary)}
      .category-nav-overflow{position:relative;flex:0 0 auto}
      .category-nav-dropdown,.category-nav-mobile-panel{position:absolute;z-index:130;top:calc(100% + 6px);left:0;width:min(420px,calc(100vw - 24px));max-height:min(60vh,420px);overflow:auto;padding:8px;border:1px solid rgba(226,232,240,.9);border-radius:14px;background:#fff;box-shadow:var(--shadow-lg);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}
      .category-nav-dropdown-link{width:100%;justify-content:flex-start;color:var(--text-soft);padding:9px 10px;min-height:36px}
      .category-nav-dropdown-link:hover{color:var(--primary-hover);background:#fff7ed}
      .category-nav-mobile{display:none}
      @media(max-width:980px){
        .category-nav{border-top:0}
        .category-nav-desktop{display:none}
        .category-nav-mobile{width:min(calc(100% - 24px),var(--container));margin-inline:auto;display:flex;align-items:center;gap:6px;min-height:48px;position:relative}
        .category-nav-mobile .home-link{min-width:74px}
        .category-nav-mobile .category-nav-trigger{min-width:94px}
        .category-nav-mobile-panel{top:calc(100% - 2px);left:0;right:0;width:auto;grid-template-columns:repeat(2,minmax(0,1fr))}
      }
      @media(max-width:520px){
        .category-nav-mobile-panel{grid-template-columns:1fr;max-height:65vh}
        .category-nav-link,.category-nav-trigger{font-size:11px}
      }
    `}</style>
  </nav>;
}
