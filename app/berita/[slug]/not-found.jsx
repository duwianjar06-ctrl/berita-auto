export const metadata={title:'Artikel tidak ditemukan',description:'Berita tidak ditemukan atau sudah tidak tersedia.',robots:{index:false,follow:true,noarchive:true}};
import Header from '../../../components/Header.jsx';
import Footer from '../../../components/Footer.jsx';
export default function ArticleNotFound(){return <><Header/><main className="container"><section className="empty"><h1>Berita tidak ditemukan</h1><p>Mungkin artikel sudah dipindahkan atau tidak tersedia.</p><p><a href="/">← Kembali ke Beranda</a></p></section></main><Footer/></>;}
