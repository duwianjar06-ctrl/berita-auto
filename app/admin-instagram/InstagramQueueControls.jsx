'use client';

import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import InstagramQueueItemCard from './InstagramQueueItemCard.jsx';

export default function InstagramQueueControls({items=[],lastSuccessAt=null,nowIso=null,normalIntervalMs=120000,limit=2200}){
  const router=useRouter();
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [selected,setSelected]=useState([]);
  const [busy,setBusy]=useState(false);
  const baseNow=Date.parse(nowIso||'')||Date.now();
  const visible=useMemo(()=>items.filter(item=>{const status=String(item.status||'').toUpperCase();const matchesFilter=filter==='all'||(filter==='queued'&&status==='QUEUED')||(filter==='waiting'&&status==='WAITING_META')||(filter==='priority'&&Number(item.priority||0)>0)||(filter==='removed'&&status==='REMOVED')||(filter==='failed'&&status==='FAILED');const matchesQuery=!query.trim()||String(item.title||'').toLowerCase().includes(query.trim().toLowerCase());return matchesFilter&&matchesQuery}),[items,filter,query]);
  const activePriority=items.find(item=>Number(item.priority||0)>0&&['QUEUED','WAITING_META'].includes(String(item.status||'').toUpperCase()))?.queueId||null;
  const fallbackBase=lastSuccessAt?new Date(Date.parse(lastSuccessAt)+Math.max(1,Number(normalIntervalMs)||120000)).toISOString():null;
  async function removeBulk(){if(!selected.length)return;setBusy(true);try{const response=await fetch('/api/admin/instagram/review',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({queueIds:selected})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.detail?.message||data?.error||'mutation_failed');setSelected([]);router.refresh()}catch(error){console.warn(error)}finally{setBusy(false)}}
  return <>
    <div className="ig-queue-toolbar" style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
      <input aria-label="Cari judul berita" placeholder="Cari judul berita..." value={query} onChange={e=>setQuery(e.target.value)} style={{flex:'1 1 260px',minHeight:38,padding:'8px 11px',border:'1px solid #dfe5ea',borderRadius:10,font:'inherit',fontSize:12}}/>
      {['all','queued','waiting','priority','removed','failed'].map(key=><button key={key} type="button" className={filter===key?'active':''} onClick={()=>setFilter(key)} style={{minHeight:34,padding:'7px 10px',border:'1px solid #dfe5ea',borderRadius:9,background:filter===key?'#17202a':'#fff',color:filter===key?'#fff':'#17202a',fontSize:10,fontWeight:800,cursor:'pointer'}}>{key==='all'?'Semua':key==='queued'?'Queued':key==='waiting'?'Waiting Meta':key==='priority'?'Prioritas':key==='removed'?'Removed':'Failed'}</button>)}
      {selected.length?<button type="button" disabled={busy} onClick={removeBulk} style={{minHeight:34,padding:'7px 10px',border:'1px solid #fecaca',borderRadius:9,background:'#fff',color:'#b42318',fontSize:10,fontWeight:800,cursor:'pointer'}}>Hapus dari Antrean ({selected.length})</button>:null}
    </div>
    {visible.map((item,index)=><InstagramQueueItemCard key={item.queueId} item={item} index={index} limit={limit} baseNow={baseNow} fallbackBase={fallbackBase} intervalMs={normalIntervalMs} activePriority={activePriority} selectable selected={selected.includes(item.queueId)} onSelectedChange={checked=>setSelected(v=>checked?[...new Set([...v,item.queueId])]:v.filter(id=>id!==item.queueId))} onChanged={()=>router.refresh()}/>) }
    {!visible.length?<div className="ig-empty"><strong>Tidak ada item</strong><p>Belum ada posting yang cocok dengan filter atau pencarian.</p></div>:null}
  </>;
}
