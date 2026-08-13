import './globals.css';
const siteUrl='https://berita-auto.vercel.app';
const title='Berita Auto - Berita Terkini Indonesia';
const description='Portal berita terkini Indonesia yang diperbarui otomatis dari berbagai sumber publik terpercaya.';
export const metadata={metadataBase:new URL(siteUrl),title:{default:title,template:'%s | Berita Auto'},description,alternates:{canonical:'/'},openGraph:{type:'website',siteName:'Berita Auto',locale:'id_ID',url:siteUrl,title,description},twitter:{card:'summary_large_image',title,description},verification:{google:process.env.GOOGLE_SITE_VERIFICATION||undefined}};
export default function Layout({children}){return <html lang="id"><body>{children}</body></html>}
