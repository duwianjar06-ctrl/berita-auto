import {unstable_cache} from 'next/cache';
import {readArticles} from './storage.js';

function publicListArticle(article={}){return{id:article.id,stableId:article.fingerprint||article.id,slug:article.slug,title:String(article.title||'').slice(0,220),excerpt:String(article.excerpt||article.summary||'').replace(/\s+/g,' ').trim().slice(0,280),category:article.category,publisher:article.publisher||article.sourceName,sourceName:article.sourceName||article.publisher,imageUrl:article.imageUrl,publishedAt:article.publishedAt||article.sitePublishedAt||article.createdAt,views:Number(article.totalViews??article.views??0)||0,todayViews:Number(article.todayViews??0)||0,imageStatus:article.imageStatus,imageSource:article.imageSource,language:article.language,translationStatus:article.translationStatus,indexable:article.indexable,robots:article.robots,sourceId:article.sourceId};}
const readCachedPublicList=unstable_cache(async()=>{const articles=await readArticles();return articles.map(publicListArticle)},['berita-auto-public-list'],{revalidate:10});
const readCachedPublicArticles=unstable_cache(async()=>readArticles(),['berita-auto-public-articles'],{revalidate:30});
export async function readPublicListArticles(){return readCachedPublicList()}
export async function readPublicArticles(){return readCachedPublicArticles()}
