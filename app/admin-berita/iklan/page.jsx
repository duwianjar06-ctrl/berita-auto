import {auth} from '../../../auth.js';
import {listAds} from '../../../lib/ads.js';
import AdsManager from '../../../components/admin/AdsManager.jsx';
import '../admin.css';
import '../ads-admin.css';

export const dynamic='force-dynamic';
export const metadata={title:'Kelola Iklan | Berita Auto',robots:{index:false,follow:false,noarchive:true}};

export default async function AdsAdminPage(){
  const session=await auth();
  const configured=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.AUTH_SECRET&&(process.env.ADMIN_EMAILS||'').trim());
  if(!configured||!session?.user)return <main className="admin-shell admin-login"><section className="login-card"><span className="admin-kicker">BERITA AUTO</span><p className="admin-label">KELOLA IKLAN</p><h1>Akses admin diperlukan.</h1><p>Masuk melalui Admin Berita untuk mengelola banner iklan.</p><a className="view-link" href="/admin-berita">Kembali ke Admin</a></section></main>;
  const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  const email=session.user.email?.trim().toLowerCase();
  if(!email||!allowed.includes(email))return <main className="admin-shell admin-login"><section className="login-card"><span className="admin-kicker">BERITA AUTO</span><p className="admin-label">KELOLA IKLAN</p><h1>Akun ini tidak memiliki akses administrator.</h1><a className="view-link" href="/admin-berita">Kembali ke Admin</a></section></main>;
  let ads=[];try{ads=await listAds()}catch{ads=[]}
  const blobConfigured=Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return <main className="admin-shell"><header className="admin-topbar"><div><span className="admin-kicker">BERITA AUTO</span><strong>Admin Console</strong></div><div className="admin-actions"><a href="/admin-berita" className="admin-link">Dashboard</a><a href="/" className="admin-link">Buka Website</a>{session.user.image&&<img className="admin-avatar" src={session.user.image} alt="" width="32" height="32"/>}<span className="admin-user">{session.user.name||email}</span></div></header><section className="admin-content"><div className="admin-page-intro"><div><p className="admin-label">MANAGEMENT</p><h1>Kelola Iklan</h1><p>Upload banner, tentukan slot yang sudah dipakai website, atur link tujuan, lalu aktifkan tanpa mengubah source code.</p></div><a className="filter-button admin-back-button" href="/admin-berita">← Admin Berita</a></div>{!blobConfigured&&<div className="admin-warning" role="status">Storage gambar belum dikonfigurasi. Upload banner belum tersedia sampai storage durable diaktifkan.</div>}<AdsManager initialAds={ads} blobConfigured={blobConfigured}/></section></main>;
}
