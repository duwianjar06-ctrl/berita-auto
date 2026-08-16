'use client';
import {useState} from 'react';

export default function ArticleShare({title,url}){
  const [copied,setCopied]=useState(false);
  const encoded=encodeURIComponent(`${title} ${url}`);
  const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),1400)}catch{window.prompt('Salin URL artikel:',url)}};
  return <div className="article-share" aria-label="Bagikan artikel">
    <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer">Telegram</a>
    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
    <a href={`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
    <button type="button" onClick={copy}>{copied?'Tersalin':'Salin Link'}</button>
  </div>;
}
