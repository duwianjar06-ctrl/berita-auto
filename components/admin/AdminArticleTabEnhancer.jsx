'use client';
import {useEffect} from 'react';
export default function AdminArticleTabEnhancer(){useEffect(()=>{const nav=document.querySelector('.admin-tabs');if(!nav||nav.querySelector('[data-article-tab]'))return;const a=document.createElement('a');a.href='/admin-berita?tab=artikel';a.textContent='Artikel';a.dataset.articleTab='true';a.className='admin-tab-link';nav.insertBefore(a,nav.children[2]||null);return()=>a.remove()},[]);return null}
