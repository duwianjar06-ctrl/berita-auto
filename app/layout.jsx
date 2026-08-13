import './globals.css';
export const metadata={title:{default:'Berita Auto',template:'%s | Berita Auto'},description:'Portal berita otomatis berbasis AI',metadataBase:new URL('https://berita-auto.vercel.app')};
export default function Layout({children}){return <html lang="id"><body>{children}</body></html>}
