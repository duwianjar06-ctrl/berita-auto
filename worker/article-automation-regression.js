import assert from 'node:assert/strict';
import {buildArticleIdea,discoverArticleOpportunity,intentSignature} from '../lib/article-ideas.js';
import {discoverArticleSources,validateResearch} from '../lib/article-research.js';
import {automationEnabled,qstashEnabled,numericFactCoverage,runArticlePipeline,evaluateArticlePublicationState} from '../lib/article-pipeline.js';
import {buildArticleImagePrompt,fallbackSvg,imageConfig} from '../lib/article-image.js';

const previous={...process.env};
try{
  process.env.ARTICLE_AUTOMATION_ENABLED='false';
  process.env.ARTICLE_QSTASH_ENABLED='false';
  const disabled=await runArticlePipeline({mode:'auto'},{dryRun:true});
  assert.equal(disabled.status,'SKIPPED');assert.equal(disabled.reason,'article_automation_disabled');
  process.env.ARTICLE_AUTOMATION_ENABLED='true';
  assert.equal(automationEnabled(),true);assert.equal(qstashEnabled(),false);
  const idea=buildArticleIdea('Cara Menyetel Karburator Motor agar Langsam Stabil',{category:'Automotive'});
  assert.equal(idea.contentType,'article');assert.equal(idea.articleType,'HOW_TO');assert.equal(idea.primaryQuery,'cara menyetel karburator motor agar langsam stabil');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url)=>{if(String(url).includes('news.google.com/rss/search'))return new Response('<rss><channel><item><title>Karburator motor stabil - Sumber A</title><link>https://example.test/a</link><pubDate>2026-08-23</pubDate><source url="https://a.example">Sumber A</source></item><item><title>Setelan karburator - Sumber B</title><link>https://example.test/b</link><source url="https://b.example">Sumber B</source></item></channel></rss>',{status:200});return new Response('<html><body><h1>Karburator</h1><p>Setelan karburator harus disesuaikan dengan model kendaraan. Putaran idle dan campuran diperiksa bertahap.</p></body></html>',{status:200,url:String(url)})};
  const discovered=await discoverArticleSources(idea);assert.ok(discovered.length>=2);assert.notEqual(discovered[0].url,discovered[1].url);
  const researched=[];for(const s of discovered.slice(0,2)){researched.push({...s,text:'Karburator dan setelan idle perlu disesuaikan dengan model kendaraan.',wordCount:9})}const research={sources:researched,facts:researched.map(x=>({source:x.name,url:x.url,material:x.text})),sourceCount:2};assert.equal(validateResearch(research,{minimumSources:2}).passed,true);
  const autoDry=await runArticlePipeline({mode:'auto'},{dryRun:true});assert.ok(['DRY_RUN','SKIPPED','NEEDS_REVIEW','UPDATE_EXISTING'].includes(autoDry.status));
  globalThis.fetch=originalFetch;
  assert.equal(numericFactCoverage('Gunakan 12 volt dan 4 langkah.',{facts:[{material:'Gunakan 12 volt pada prosedur.'}]}),50);
  const config=imageConfig();assert.equal(config.aspectRatio,'16:9');assert.equal(config.width,1200);assert.equal(config.height,675);assert.ok(config.model);
  assert.match(buildArticleImagePrompt(idea),/Berita Auto/);assert.match(buildArticleImagePrompt(idea),/16:9/);assert.ok(fallbackSvg(idea,config).length>500);
  assert.notEqual(intentSignature('cara mengecek aki motor'),intentSignature('cara merawat aki motor'),'different intents must not collapse into one signature');
  assert.equal(evaluateArticlePublicationState({searchScore:100,sourceCount:5,articleQuality:{qualityScore:92,status:'READY'},imageUrl:'https://example.test/image.jpg',reviewReasons:[]}).eligible,true);
  assert.equal(evaluateArticlePublicationState({searchScore:100,sourceCount:5,articleQuality:{qualityScore:92,status:'READY'},imageStatus:'failed',reviewReasons:['image_generation_failed']}).eligible,false);
  console.log('article automation regression: PASS autonomous gates + opportunity + source discovery + dynamic intent guard + image config/fallback + publication gate');
}finally{for(const key of Object.keys(process.env)){if(!(key in previous))delete process.env[key]}Object.assign(process.env,previous)}
