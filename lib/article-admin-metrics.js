import {articlePath,isArticleRouteResolvable} from './article-url.js';
import {isIndexableArticle} from './article-seo.js';
const redisUrl=()=>process.env.UPSTASH_REDIS_REST_URL;
const redisToken=()=>process.env.UPSTASH_REDIS_REST_TOKEN;
export function articleMetricsConfigured(){return Boolean(redisUrl()&&redisToken())}
async function pipeline(commands){if(!articleMetricsConfigured())return[];const response=await fetch(`${redisUrl()}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${redisToken()}`,'Content-Type':'application/json'},body:JSON.stringify(commands),cache:'no-store'});if(!response.ok)throw new Error(`article metrics redis ${response.status}`);return response.json()}
export async function getArticleViewCounts(articleIds=[]){const ids=[...new Set(articleIds.map(id=>String(id||'').trim()).filter(Boolean))];if(!ids.length)return new Map();if(!articleMetricsConfigured())return new Map(ids.map(id=>[id,0]));const rows=await pipeline(ids.map(id=>['ZSCORE','ba:views:alltime',id]));return new Map(ids.map((id,i)=>[id,Number(rows?.[i]?.result)||0]))}
export function sitemapStatus(article={}){const published=String(article.status||'').toUpperCase()==='PUBLISHED';const indexable=isIndexableArticle(article)&&isArticleRouteResolvable(article);const path=article?.slug?articlePath(article):null;const url=path?`https://berita-auto.vercel.app${path}`:null;return{included:Boolean(published&&indexable&&path),url,lastSitemapCheckAt:new Date().toISOString(),reason:published&&indexable&&path?null:(!published?'not_published':!indexable?'not_indexable':'missing_route')}}
