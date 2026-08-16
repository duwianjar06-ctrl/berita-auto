import {readArticles} from '../lib/storage.js';
import {persistenceConfigured,acquireLock,releaseLock,setJson} from '../lib/persistence.js';
import {instagramConfigured,instagramConfig} from '../lib/instagram.js';
import {SOCIAL_LOCK_KEY,SOCIAL_LOCK_TTL,deterministicCaption} from '../lib/social.js';
import {buildSocialSlides} from '../lib/social-visual.js';
import {createAndPublishMedia} from './social-run.js';

const articleId=String(process.argv[2]||'').trim();
const confirm=String(process.env.SOCIAL_REPAIR_CONFIRM||'').trim();
const expectedOldMediaId=String(process.env.SOCIAL_REPAIR_OLD_MEDIA_ID||'').trim();
if(!articleId||confirm!=='REPAIR')throw new Error('repair_requires_article_id_and_SOCIAL_REPAIR_CONFIRM=REPAIR');
if(!persistenceConfigured()||!instagramConfigured())throw new Error('repair_requires_social_configuration');
const articles=await readArticles();
const article=articles.find(item=>String(item?.id||'')===articleId);
if(!article)throw new Error('repair_article_not_found');
const existing=expectedOldMediaId?{oldMediaId:expectedOldMediaId}:null;
const token=`repair:${process.pid}:${Date.now()}`;
if(!(await acquireLock(SOCIAL_LOCK_KEY,token,SOCIAL_LOCK_TTL)))throw new Error('repair_lock_busy');
try{
  const slides=buildSocialSlides(article);
  if(slides.length<1||slides.length>2)throw new Error('repair_invalid_slide_count');
  const result=await createAndPublishMedia(article,deterministicCaption(article,instagramConfig().siteUrl),instagramConfig().siteUrl);
  if(!result?.mediaId)throw new Error('repair_publish_failed');
  const publishedAt=new Date().toISOString();
  const record={mode:'repair',articleId,oldMediaId:existing?.oldMediaId||null,newMediaId:result.mediaId,parentId:result.containerId||null,childIds:result.childIds||[],slideCount:slides.length,publishedAt,updatedAt:publishedAt};
  await setJson(`ba:social:instagram:repair:${articleId}:${result.mediaId}`,record);
  console.log(JSON.stringify({status:'repaired',...record}));
}finally{await releaseLock(SOCIAL_LOCK_KEY,token).catch(()=>{});}
