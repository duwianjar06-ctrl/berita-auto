import './globals.css';
import '../components/ads.css';
import './timestamp.css';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
const siteUrl='https://berita-auto.vercel.app';
const title='Berita Auto - Berita Terkini Indonesia';
const description='Portal berita terkini Indonesia yang diperbarui otomatis dari berbagai sumber publik terpercaya.';
export const metadata={metadataBase:new URL(siteUrl),title:{default:title,template:'%s | Berita Auto'},description,alternates:{canonical:'/'},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},openGraph:{type:'website',siteName:'Berita Auto',locale:'id_ID',url:siteUrl,title,description},twitter:{card:'summary_large_image',title,description},verification:{google:process.env.GOOGLE_SITE_VERIFICATION||undefined}};
export default function Layout({children}){return <html lang="id"><body>{children}<SpeedInsights /><Analytics /></body></html>}
