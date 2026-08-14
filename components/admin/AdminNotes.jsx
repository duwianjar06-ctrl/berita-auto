'use client';

import {useEffect, useMemo, useState} from 'react';

function makeId(){
  try{return crypto.randomUUID();}catch{return `${Date.now()}-${Math.random().toString(36).slice(2)}`;}
}

function formatDate(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '-';
  return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(date)+' WIB';
}

function sortNotes(items){
  return [...items].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt));
}

export default function AdminNotes({email}){
  const storageKey=useMemo(()=>`berita-auto-admin-notes:${email}`,[email]);
  const draftKey=useMemo(()=>`berita-auto-admin-notes-draft:${email}`,[email]);
  const [notes,setNotes]=useState([]);
  const [title,setTitle]=useState('');
  const [content,setContent]=useState('');
  const [loaded,setLoaded]=useState(false);
  const [draftRestored,setDraftRestored]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [editedTitle,setEditedTitle]=useState('');
  const [editedContent,setEditedContent]=useState('');
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [expandedId,setExpandedId]=useState(null);
  const [toast,setToast]=useState('');

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(storageKey);
      const saved=raw?JSON.parse(raw):[];
      setNotes(Array.isArray(saved)?saved:[]);
      const draftRaw=localStorage.getItem(draftKey);
      if(draftRaw){
        const draft=JSON.parse(draftRaw);
        if(draft?.title||draft?.content){setTitle(draft.title||'');setContent(draft.content||'');}
      }
    }catch{
      setNotes([]);
    }finally{
      setDraftRestored(true);
      setLoaded(true);
    }
  },[storageKey,draftKey]);

  useEffect(()=>{
    if(!loaded)return;
    try{localStorage.setItem(storageKey,JSON.stringify(notes));}catch{}
  },[loaded,notes,storageKey]);

  useEffect(()=>{
    if(!loaded||!draftRestored)return;
    try{
      if(title.trim()||content.trim())localStorage.setItem(draftKey,JSON.stringify({title,content}));
      else localStorage.removeItem(draftKey);
    }catch{}
  },[loaded,draftRestored,title,content,draftKey]);

  useEffect(()=>{
    if(!toast)return;
    const timer=setTimeout(()=>setToast(''),2200);
    return()=>clearTimeout(timer);
  },[toast]);

  function addNote(){
    const body=content.trim();
    if(!body)return;
    const now=new Date().toISOString();
    const note={id:makeId(),title:title.trim(),content:body,pinned:false,createdAt:now,updatedAt:now};
    setNotes(items=>sortNotes([note,...items]));
    setTitle('');
    setContent('');
    try{localStorage.removeItem(draftKey);}catch{}
    setToast('Catatan berhasil disimpan.');
  }

  function togglePin(id){
    setNotes(items=>sortNotes(items.map(note=>note.id===id?{...note,pinned:!note.pinned,updatedAt:new Date().toISOString()}:note)));
  }

  function startEdit(note){
    setEditingId(note.id);setEditedTitle(note.title||'');setEditedContent(note.content||'');
  }

  function saveEdit(){
    if(!editingId||!editedContent.trim())return;
    const now=new Date().toISOString();
    setNotes(items=>sortNotes(items.map(note=>note.id===editingId?{...note,title:editedTitle.trim(),content:editedContent.trim(),updatedAt:now}:note)));
    setEditingId(null);setEditedTitle('');setEditedContent('');
    setToast('Catatan berhasil diperbarui.');
  }

  function deleteNote(){
    if(!deleteTarget)return;
    setNotes(items=>items.filter(note=>note.id!==deleteTarget));
    setDeleteTarget(null);
    setToast('Catatan berhasil dihapus.');
  }

  return <section className="admin-notes">
    <div className="admin-notes-header">
      <div><p className="admin-label">PERSONAL NOTES</p><h2 className="admin-notes-title">Catatan Saya</h2><p className="admin-notes-subtitle">Catatan pribadi dan pengingat administrator.</p></div>
      <span className="admin-notes-count">{notes.length} catatan</span>
    </div>
    <div className="admin-note-compose">
      <input className="admin-note-title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul catatan (opsional)" aria-label="Judul catatan" />
      <textarea className="admin-note-textarea" value={content} onChange={e=>setContent(e.target.value)} placeholder="Tulis catatan atau pengingat untuk diri sendiri..." aria-label="Isi catatan" />
      <div className="admin-note-compose-actions"><span className="admin-note-draft">Draft tersimpan otomatis di perangkat ini.</span><button className="admin-note-save" type="button" onClick={addNote} disabled={!content.trim()}>Simpan Catatan</button></div>
    </div>
    {toast&&<div className="admin-note-toast" role="status">{toast}</div>}
    <div className="admin-notes-list">
      {!notes.length?<div className="admin-notes-empty"><strong>Belum ada catatan.</strong><span>Tulis catatan pertama Anda untuk menyimpan ide, pengingat, atau pekerjaan yang perlu ditindaklanjuti.</span></div>:sortNotes(notes).map(note=>{
        const long=note.content.length>260;
        const open=expandedId===note.id;
        const visible=open||!long?note.content:`${note.content.slice(0,260)}…`;
        return <article className={`admin-note-card${note.pinned?' is-pinned':''}`} key={note.id}>
          {editingId===note.id?<div className="admin-note-edit"><input className="admin-note-title-input" value={editedTitle} onChange={e=>setEditedTitle(e.target.value)} placeholder="Judul catatan (opsional)" aria-label="Edit judul catatan"/><textarea className="admin-note-textarea" value={editedContent} onChange={e=>setEditedContent(e.target.value)} aria-label="Edit isi catatan"/><div className="admin-note-edit-actions"><button className="admin-note-action" type="button" onClick={()=>{setEditingId(null);setEditedTitle('');setEditedContent('')}}>Batal</button><button className="admin-note-save compact" type="button" disabled={!editedContent.trim()} onClick={saveEdit}>Simpan</button></div></div>:<>
            <div className="admin-note-card-head"><div>{note.pinned&&<span className="admin-note-pin-badge">📌 PINNED</span>}<h3>{note.title||'Catatan tanpa judul'}</h3></div></div>
            <p className="admin-note-content">{visible}</p>
            {long&&<button className="admin-note-more" type="button" onClick={()=>setExpandedId(open?null:note.id)}>{open?'Tutup':'Lihat selengkapnya'}</button>}
            <div className="admin-note-footer"><div className="admin-note-date"><span>Dibuat: {formatDate(note.createdAt)}</span><span>Diedit: {formatDate(note.updatedAt)}</span></div><div className="admin-note-actions"><button className="admin-note-action" type="button" onClick={()=>togglePin(note.id)}>{note.pinned?'Unpin':'Pin'}</button><button className="admin-note-action" type="button" onClick={()=>startEdit(note)}>Edit</button><button className="admin-note-action danger" type="button" onClick={()=>setDeleteTarget(note.id)}>Hapus</button></div></div>
          </>}
        </article>;
      })}
    </div>
    {deleteTarget&&<div className="admin-note-modal-backdrop" role="presentation" onClick={()=>setDeleteTarget(null)}><div className="admin-note-modal" role="dialog" aria-modal="true" aria-labelledby="delete-note-title" onClick={e=>e.stopPropagation()}><div className="admin-note-modal-icon">!</div><h3 id="delete-note-title">Hapus catatan?</h3><p>Catatan yang dihapus tidak dapat dikembalikan.</p><div className="admin-note-modal-actions"><button className="admin-note-action" type="button" onClick={()=>setDeleteTarget(null)}>Batal</button><button className="admin-note-delete" type="button" onClick={deleteNote}>Hapus</button></div></div></div>}
  </section>;
}
