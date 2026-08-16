import {readArticles} from './storage.js';
import {getJson,persistenceConfigured} from './persistence.js';
import {instagramConfigured,instagramConfig} from './instagram.js';
import {socialConfig,getLastPublishedAt,readRecentPublished,readSocialQueue} from './social.js';
import {getSocialFontDiagnostics} from './social-fonts.js';
import {readSocialRuns} from './social-telemetry.js';
import {sanitizeCardText} from './social-visual.js';

function maskId(value){const s=String(value||'');return s.length<=6?s:`${s.slice(0,3)}…${s.slice(-3)}`;}
function safeArticle(article){if(!article)return null;return{id:article.id,stableId:article.stableId||article.id,slug:article.slug||article.id,title:String(article.title||'Berita terbaru').slice(0,180),category:article.category||'Berita',publisher:article.publisher||article.sourceName||'Sumber publik',publishedAt:article.sitePublishedAt||article.publishedAt||article.createdAt||null,canonicalUrl:`${String(process.env.SITE_URL||'https://berita-auto.vercel.app').replace(/\/$/,'')}/berita/${encodeURIComponent(article.slug||article.id)}`,imageSource:article.imageSource||article.imageStatus||'unknown',imageStatus:article.imageStatus||null};}
function nextEligible(last,minutes){if(!last)return null;return new Date(Date.parse(last)+minutes*60000).toISOString();}
function triggerLabel(source){return['qstash','vercel-cron','github-actions','manual','internal','unknown'].includes(source)?source:'unknown';}

export async function getAdminInstagramStatus(){
  const now=Date.now();
  const cfg=instagramConfig();
  const socialCfg=socialConfig();
  const articles=await readArticles();
  const published=await readRecentPublished(50);
  const queue=await readSocialQueue(100);
  const runs=await readSocialRuns(50);
  const lastPublishedAt=await getLastPublishedAt();
  const next=nextEligible(lastPublishedAt,socialCfg.minIntervalMinutes);
  const remainingMs=next?Math.max(0,Date.parse(next)-now):0;
  const latestRun=runs[0]||null;
  const latestPost=published[0]||null;
  const latestItem=latestRun?.articleId?await getJson(`ba:social:instagram:item:${latestRun.articleId}`):null;
  const articleMap=new Map(articles.map(a=>[String(a.id),a]));
  const latestArticle=safeArticle(articleMap.get(String(latestRun?.articleId||latestPost?.articleId||''))||latestItem?.article);
  const sample=latestArticle?sanitizeCardText(`${latestArticle.title} ${latestArticle.publisher}`):'';
  const font=getSocialFontDiagnostics(sample);
  const previewArticleId=latestRun?.articleId||latestPost?.articleId||queue[0]?.articleId||null;
  const siteUrl=String(cfg.siteUrl||'https://berita-auto.vercel.app').replace(/\/$/,'');
  const previewUrl=previewArticleId?`${siteUrl}/api/social-card/${encodeURIComponent(previewArticleId)}?slide=1`:null;
  const runRows=runs.map(run=>({...run,triggerSource:triggerLabel(run.triggerSource),article:safeArticle(articleMap.get(String(run.articleId||''))||run.article)}));
  const postRows=published.map(post=>({...post,article:safeArticle(articleMap.get(String(post.articleId||''))||post.article),previewUrl:`${siteUrl}/api/social-card/${encodeURIComponent(post.articleId||'')}?slide=1`}));
  return{refreshedAt:new Date(now).toISOString(),persistence:{configured:persistenceConfigured()},automation:{status:!cfg.enabled?'INACTIVE':instagramConfigured()?'ACTIVE':'DEGRADED',credentials:instagramConfigured()?'CONFIGURED':'MISSING',userId:maskId(cfg.userId),apiVersion:cfg.apiVersion,siteUrl},scheduler:{actual:'vercel-cron',qstash:'NOT DETECTED',vercelCron:{configured:Boolean(process.env.CRON_SECRET),schedule:'Configured in Vercel project settings',lastTrigger:latestRun?.startedAt||null,lastResult:latestRun?.status||null},githubActions:'NOT DETECTED'},cooldown:{configuredIntervalMinutes:socialCfg.minIntervalMinutes,lastSuccessfulPost:lastPublishedAt||null,nextEligible:next,remainingMs,state:remainingMs>0?'COOLDOWN':'READY'},latestRun:latestRun?{...latestRun,article:latestArticle,item:latestItem}:null,latestPost:latestPost?{...latestPost,article:safeArticle(articleMap.get(String(latestPost.articleId||''))||latestPost.article)}:null,latestRender:latestRun?.render||null,font,previewUrl,runs:runRows,posts:postRows,queue:queue.slice(0,20).map(item=>({...item,article:safeArticle(item.article)})),counts:{runs:runs.length,posts:published.length,queue:queue.length,success:runs.filter(r=>r.status==='published'||r.status==='success').length,failed:runs.filter(r=>r.status==='failed').length,cooldown:runs.filter(r=>r.status==='cooldown'||r.reason==='cooldown').length,skipped:runs.filter(r=>r.status==='skipped'||r.reason?.startsWith('already_')).length}};
}
