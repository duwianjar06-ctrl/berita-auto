import assert from 'node:assert/strict';
import {articlePath,articleStableId} from '../lib/article-url.js';
import {validateArticleForInstagram,prepareInstagramCandidate} from '../lib/social-preparation.js';

const base='https://berita-auto.vercel.app';
const article={id:'0123456789abcdef01234567',stableId:'0123456789abcdef01234567',slug:'china-tegaskan-komitmen-menepati-janji-melalui-tindakan-nyata',title:'China tegaskan komitmen menepati janji melalui tindakan nyata',category:'Internasional',publisher:'ANTARA',sitePublishedAt:'2026-08-17T00:00:00Z',sourcePublishedAt:'2026-08-16T23:55:00Z',sourceUrl:'https://example.com/source'};
const canonical=`${base}${articlePath(article)}`;
let requested=[];
const fetchImpl=async url=>{requested.push(String(url));return new Response('<html>ok</html>',{status:String(url)===canonical?200:404,headers:{'content-type':'text/html'},url:String(url)});};

assert.equal(articleStableId(article),article.stableId);
const check=await validateArticleForInstagram(article,{siteUrl:base,fetchImpl});
assert.equal(check.valid,true);
assert.equal(check.canonicalUrl,canonical);
assert.ok(check.canonicalUrl.endsWith('-01234567'));
assert.ok(!check.canonicalUrl.endsWith(`/${article.slug}`));
assert.equal(requested.at(-1),canonical);

const repaired=await validateArticleForInstagram({...article,canonicalUrl:`${base}/berita/${article.slug}`},{siteUrl:base,fetchImpl});
assert.equal(repaired.valid,true);
assert.equal(repaired.canonicalUrl,canonical);
assert.equal(repaired.publicStatus,'PASS');

const missing=await validateArticleForInstagram({...article,id:null},{siteUrl:base,checkPublicUrl:false});
assert.equal(missing.failureCode,'ARTICLE_MISSING_ID');
const noStable=await validateArticleForInstagram({...article,id:'not-a-stable-id',fingerprint:null,stableId:null},{siteUrl:base,checkPublicUrl:false});
assert.equal(noStable.failureCode,'CANONICAL_URL_MISSING');
const unpublished=await validateArticleForInstagram({...article,sitePublishedAt:null},{siteUrl:base,checkPublicUrl:false});
assert.equal(unpublished.failureCode,'ARTICLE_NOT_PUBLISHED');
const notFound=await validateArticleForInstagram(article,{siteUrl:base,fetchImpl:async url=>new Response('not found',{status:404,headers:{'content-type':'text/html'},url:String(url)})});
assert.equal(notFound.failureCode,'CANONICAL_URL_404');
const timeout=await validateArticleForInstagram(article,{siteUrl:base,fetchImpl:async(_url,{signal})=>await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})))),timeoutMs:1});
assert.equal(timeout.failureCode,'CANONICAL_URL_TIMEOUT');

const prepared=await prepareInstagramCandidate(article,{siteUrl:base,full:false,fetchImpl});
assert.equal(prepared.status,'INVALID');
assert.equal(prepared.reason,'CARD_SLIDE_COUNT_INVALID');
assert.equal(prepared.articleCheck.failureCode,null);
console.log('Instagram canonical routing regression: PASS authoritative stable article path, legacy slug repair, structured invalid reasons');
