'use client';
import {useEffect} from 'react';
export default function ArticleViewTracker({articleId}){useEffect(()=>{if(!articleId)return;const key=`ba-view:${articleId}`;try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1')}catch{}fetch('/api/analytics/view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({articleId}),credentials:'same-origin',keepalive:true}).catch(()=>{})},[articleId]);return null}
