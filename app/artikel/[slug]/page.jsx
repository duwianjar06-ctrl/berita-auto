import {notFound} from 'next/navigation';
import {findArticle,listPublishedArticles,listAllArticles} from '../../../lib/article-storage.js';
import {readPublicListArticles} from '../../../lib/public-data.js';
import {getPopularArticles} from '../../../lib/analytics.js';
import {categories} from '../../../lib/categories.js';
import ArticleDetailView from '../../../components/article/ArticleDetailView.jsx';
import '../artikel.css';
const base='https://berita-auto.vercel.app';
export const dynamic='force-dynamic';
export async function generateMetadata({params}){const a=await findArticle((await params).slug);if(!a||a.status!=='PUBLISHED')return{robots:{index:false,follow:false}};const canonical=`${base}/artikel/${a.slug}`;return{title:a.metaTitle||a.title,description:a.metaDescription||a.excerpt,alternates:{canonical},robots:{index:true,follow:true},openGraph:{type:'article',url:canonical,title:a.metaTitle||a.title,description:a.metaDescription||a.excerpt,siteName:'Berita Auto',images:a.imageUrl?[{url:a.imageUrl,width:1200,height:675,alt:a.imageAlt||a.title}]:[]}}}
function categoryCounts(items){const counts=Object.fromEntries(categories.map(c=>[c,0]));for(const a of items){const c=categories.find(x=>x.toLowerCase()===String(a.category||'').toLowerCase());if(c)counts[c]++}return counts}
export default async function ArticleDetail({params}){const a=await findArticle((await params).slug);if(!a||a.status!=='PUBLISHED')notFound();const [all,news]=await Promise.all([listPublishedArticles(),readPublicListArticles()]);const popular=await getPopularArticles(all,7,5);const relatedArticles=all.filter(x=>x.id!==a.id&&(x.category===a.category||x.topicCluster===a.topicCluster));const relatedNews=news.filter(x=>x.contentType!=='article'&&x.category===a.category);return <ArticleDetailView article={a} latestArticles={all} popularArticles={popular} latestNews={news} relatedArticles={relatedArticles} relatedNews={relatedNews} categoryCounts={categoryCounts([...all,...news])}/>}
