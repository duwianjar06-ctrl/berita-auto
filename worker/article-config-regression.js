import assert from 'node:assert/strict';

const previous={...process.env};
try{
  for(const key of ['ARTICLE_AUTOMATION_ENABLED','ARTICLE_MAX_PER_DAY','ARTICLE_MIN_INTERVAL_MINUTES','ARTICLE_MIN_SEARCH_SCORE','ARTICLE_MIN_QUALITY_SCORE','ARTICLE_QSTASH_ENABLED','ARTICLE_RESEARCH_GROUNDING_ENABLED','ARTICLE_IMAGE_ENABLED','ARTICLE_IMAGE_PROVIDER','ARTICLE_IMAGE_MODEL','ARTICLE_IMAGE_ASPECT_RATIO','ARTICLE_IMAGE_WIDTH','ARTICLE_IMAGE_HEIGHT','ARTICLE_IMAGE_STORAGE','ARTICLE_IMAGE_FALLBACK','ARTICLE_IMAGE_DISCLOSURE'])delete process.env[key];
  const {ARTICLE_CONFIG}=await import('../lib/article-config.js?defaults=1');
  assert.equal(ARTICLE_CONFIG.automationEnabled,true);
  assert.equal(ARTICLE_CONFIG.maxPerDay,4);
  assert.equal(ARTICLE_CONFIG.minIntervalMinutes,180);
  assert.equal(ARTICLE_CONFIG.minSearchScore,70);
  assert.equal(ARTICLE_CONFIG.minQualityScore,75);
  assert.equal(ARTICLE_CONFIG.qstashEnabled,false);
  assert.equal(ARTICLE_CONFIG.researchGroundingEnabled,true);
  assert.equal(ARTICLE_CONFIG.image.enabled,true);
  assert.equal(ARTICLE_CONFIG.image.provider,'gemini');
  assert.equal(ARTICLE_CONFIG.image.model,'gemini-3.1-flash-image');
  assert.equal(ARTICLE_CONFIG.image.aspectRatio,'16:9');
  assert.equal(ARTICLE_CONFIG.image.width,1200);
  assert.equal(ARTICLE_CONFIG.image.height,675);
  assert.equal(ARTICLE_CONFIG.image.storage,'blob');
  assert.equal(ARTICLE_CONFIG.image.fallback,'branded');
  assert.equal(ARTICLE_CONFIG.image.disclosure,true);
  process.env.ARTICLE_AUTOMATION_ENABLED='false';process.env.ARTICLE_MAX_PER_DAY='9';process.env.ARTICLE_QSTASH_ENABLED='true';process.env.ARTICLE_IMAGE_MODEL='override-model';
  const {ARTICLE_CONFIG:override}=await import('../lib/article-config.js?override=1');
  assert.equal(override.automationEnabled,false);assert.equal(override.maxPerDay,9);assert.equal(override.qstashEnabled,true);assert.equal(override.image.model,'override-model');
  assert.equal(process.env.GEMINI_API_KEY,previous.GEMINI_API_KEY);
  console.log('article config regression: PASS defaults + optional ENV overrides + no secret config');
}finally{for(const key of Object.keys(process.env)){if(!(key in previous))delete process.env[key]}Object.assign(process.env,previous)}
