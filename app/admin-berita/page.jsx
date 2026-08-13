import {auth, signIn, signOut} from '../../auth.js';
import {readArticles} from '../../lib/storage.js';
import {articlePath} from '../../lib/article-url.js';
import {categories} from '../../lib/categories.js';
import './admin.css';

export const dynamic='force-dynamic';
export const metadata={title:'Admin Console | Berita Auto',robots:{index:false,follow:false,noarchive:true}};

function formatDate(value){if(!value)return '-';const d=new Date(value);return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(d)+' WIB'}
function todayCount(items){const now=new Date();return items.filter(a=>{const d=new Date(a.publishedAt||a.createdAt);return !Number.isNaN(d.getTime())&&d.toDateString()===now.toDateString()}).length}

export default async function AdminPage({searchParams}){
  const session=await auth();
  if(!session?.user){
    const error=searchParams?.error==='AccessDenied';
    return <main className="admin-shell admin-login"><section className="login-card"><span className="admin-kicker">BERITA AUTO</span><p className="admin-label">ADMIN CONSOLE</p><h1>Masuk ke Admin</h1><p>Gunakan akun Google administrator untuk melanjutkan.</p>{error&&<div className="admin-error">Akun ini tidak memiliki akses administrator.</div>}<form action={async()=>{'use server';await signIn('google',{redirectTo:'/admin-berita'})}}><button className="google-button" type="submit">Masuk dengan Google</button></form></section></main>
  }
  const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  const email=session.user.email?.trim().toLowerCase();
  if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET||!process.env.AUTH_SECRET||!allowed.length)return <main className="admin-shell admin-login"><section className="login-card"><span className="admin-kicker">BERITA AUTO</span><p className="admin-label">ADMIN CONSOLE</p><h1>Admin authentication belum dikonfigurasi.</h1></section></main>;
  if(!email||!allowed.includes(email))return <main className="admin-shell admin-login"><section className="login-card"><span className="admin-kicker">BERITA AUTO</span><p className="admin-label">ADMIN CONSOLE</p><h1>Akun ini tidak memiliki akses administrator.</h1></section></main>;
  const items=await readArticles();
  const q=(searchParams?.q||'').trim().toLowerCase();
  const category=(searchParams?.category||'').trim().toLowerCase();
  const page=Math.max(1,Number(searchParams?.page||1)||1), perPage=20;
  const filtered=items.filter(a=>(!q||[a.title,a.sourceName,a.category].some(v=>String(v||'').toLowerCase().includes(q)))&&(!category||String(a.category||'').toLowerCase()===category));
  const pageCount=Math.max(1,Math.ceil(filtered.length/perPage));
  const current=Math.min(page,pageCount); const visible=filtered.slice((current-1)*perPage,current*perPage);
  const cats=[...new Set([...categories,...items.map(a=>a.category).filter(Boolean)])];
  const counts=items.reduce((m,a)=>(m[a.category||'Tanpa Kategori']=(m[a.category||'Tanpa Kategori']||0)+1,m),{});
  const latest=items[0];
  const formQuery=(extra={})=>new URLSearchParams({...(q?{q}:{}),...(category?{category}:{}),...extra}).toString();
  return <main className="admin-shell"><header className="admin-topbar"><div><span className="admin-kicker">BERITA AUTO</span><strong>Admin Console</strong></div><div className="admin-actions"><a href="/" className="admin-link">Buka Website</a><span className="admin-user">{session.user.name||email}</span><form action={async()=>{'use server';await signOut({redirectTo:'/admin-berita'})}}><button className="ghost-button" type="submit">Keluar</button></form></div></header><section className="admin-content"><div className="admin-stats"><div><span>Total Artikel</span><strong>{items.length}</strong></div><div><span>Artikel Hari Ini</span><strong>{todayCount(items)}</strong></div><div><span>Total Kategori</span><strong>{cats.length}</strong></div><div><span>Update Terakhir</span><strong>{latest?formatDate(latest.createdAt):'-'}</strong></div></div><div className="admin-grid"><section className="admin-panel wide"><div className="panel-head"><div><p className="admin-label">CONTENT</p><h2>Artikel Terbaru</h2></div><form className="admin-filters"><input name="q" defaultValue={q} placeholder="Cari artikel..."/><select name="category" defaultValue={category}><option value="">Semua Kategori</option>{cats.map(c=><option key={c} value={c.toLowerCase()}>{c}</option>)}</select><button type="submit" className="filter-button">Cari</button></form></div><div className="article-table">{visible.map(a=><article key={a.id} className="article-row"><div className="thumb">{a.imageUrl?<img src={a.imageUrl} alt={a.title} width="160" height="100"/>:<span>BA</span>}</div><div className="article-main"><a href={articlePath(a)}><h3>{a.title}</h3></a><p>{a.category||'Tanpa Kategori'} · {a.sourceName||'Sumber publik'}</p></div><div className="article-meta"><span>{formatDate(a.publishedAt)}</span><small>{formatDate(a.createdAt)}</small></div><a className="view-link" href={articlePath(a)}>Lihat</a></article>)}{!visible.length&&<div className="empty-state">Tidak ada artikel yang cocok.</div>}</div><div className="pagination">{current>1&&<a href={'/admin-berita?'+formQuery({page:current-1})}>← Sebelumnya</a>}<span>Halaman {current} / {pageCount}</span>{current<pageCount&&<a href={'/admin-berita?'+formQuery({page:current+1})}>Berikutnya →</a>}</div></section><aside className="admin-side"><section className="admin-panel"><p className="admin-label">DISTRIBUSI</p><h2>Distribusi Kategori</h2><div className="bar-list">{Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name,count])=><div key={name}><div><span>{name}</span><strong>{count}</strong></div><i style={{width:`${Math.max(4,Math.round(count/items.length*100))}%`}}/></div>)}</div></section><section className="admin-panel"><p className="admin-label">AUTOMATION</p><h2>Status Konten</h2><dl className="summary-list"><div><dt>Target scheduler</dt><dd>±5 menit</dd></div><div><dt>Latest article</dt><dd>{latest?.title||'-'}</dd></div><div><dt>Generated</dt><dd>{latest?formatDate(latest.createdAt):'-'}</dd></div><div><dt>Source</dt><dd>{latest?.sourceName||'-'}</dd></div><div><dt>Category</dt><dd>{latest?.category||'-'}</dd></div></dl></section><section className="admin-panel"><p className="admin-label">ACTIVITY</p><h2>Aktivitas Terbaru</h2><div className="activity-list">{items.slice(0,5).map(a=><div key={a.id}><time>{formatDate(a.createdAt)}</time><p>Artikel dipublish</p><strong>{a.title}</strong></div>)}</div></section></aside></div></section></main>}
