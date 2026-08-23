import {findArticle,listPublishedArticles} from '../../../../lib/article-storage.js';
import {readPublicListArticles} from '../../../../lib/public-data.js';
import {getPopularArticles} from '../../../../lib/analytics.js';
import {categories} from '../../../../lib/categories.js';
import ArticleDetailView from '../../../../components/article/ArticleDetailView.jsx';
import '../../../artikel/artikel.css';
export const dynamic='force-dynamic';
export async function generateMetadata(){return{title:'Preview Artikel | Berita Auto',robots:{index:false,follow:false},openGraph:{robots:'noindex,nofollow'}}}
function categoryCounts(items){const counts=Object.fromEntries(categories.map(c=>[c,0]));for(const a of items){const c=categories.find(x=>x.toLowerCase()===String(a.category||'').toLowerCase());if(c)counts[c]++}return counts}
export default async function ArticlePreview({params}){const a=await findArticle((await params).id);if(!a)return <main style={{padding:40}}>Artikel tidak ditemukan.</main>;const [all,news]=await Promise.all([listPublishedArticles(),readPublicListArticles()]);const popular=await getPopularArticles(all,7,5);const relatedArticles=all.filter(x=>x.id!==a.id).sort((x,y)=>{const score=z=>(z.topicCluster&&a.topicCluster&&z.topicCluster===a.topicCluster?50:0)+(z.category&&a.category&&String(z.category).toLowerCase()===String(a.category).toLowerCase()?20:0);return score(y)-score(x)});const relatedNews=news.filter(x=>x.contentType!=='article'&&x.id!==a.id);return <ArticleDetailView article={a} preview latestArticles={all.length?all:[a]} popularArticles={popular} latestNews={news} relatedArticles={relatedArticles} relatedNews={relatedNews} categoryCounts={categoryCounts([...all,...news,a])}/>}
