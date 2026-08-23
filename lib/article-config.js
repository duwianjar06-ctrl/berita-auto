const boolEnv=(name,fallback)=>{const value=process.env[name];if(value===undefined||value==='')return fallback;return String(value).toLowerCase()==='true'};
const numberEnv=(name,fallback)=>{const value=process.env[name];if(value===undefined||value==='')return fallback;const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback};
const stringEnv=(name,fallback)=>{const value=process.env[name];return value===undefined||value===''?fallback:String(value)};

export const ARTICLE_CONFIG={
  automationEnabled:boolEnv('ARTICLE_AUTOMATION_ENABLED',true),
  maxPerDay:Math.max(1,numberEnv('ARTICLE_MAX_PER_DAY',4)),
  minIntervalMinutes:Math.max(0,numberEnv('ARTICLE_MIN_INTERVAL_MINUTES',180)),
  minSearchScore:numberEnv('ARTICLE_MIN_SEARCH_SCORE',70),
  minQualityScore:numberEnv('ARTICLE_MIN_QUALITY_SCORE',75),
  qstashEnabled:boolEnv('ARTICLE_QSTASH_ENABLED',false),
  researchGroundingEnabled:boolEnv('ARTICLE_RESEARCH_GROUNDING_ENABLED',true),
  image:{
    enabled:boolEnv('ARTICLE_IMAGE_ENABLED',true),
    provider:stringEnv('ARTICLE_IMAGE_PROVIDER','gemini').toLowerCase(),
    model:stringEnv('ARTICLE_IMAGE_MODEL','gemini-3.1-flash-image'),
    aspectRatio:stringEnv('ARTICLE_IMAGE_ASPECT_RATIO','16:9'),
    width:Math.max(1,numberEnv('ARTICLE_IMAGE_WIDTH',1200)),
    height:Math.max(1,numberEnv('ARTICLE_IMAGE_HEIGHT',675)),
    storage:stringEnv('ARTICLE_IMAGE_STORAGE','blob').toLowerCase(),
    fallback:stringEnv('ARTICLE_IMAGE_FALLBACK','open_license').toLowerCase(),
    disclosure:boolEnv('ARTICLE_IMAGE_DISCLOSURE',true),
    templateVersion:Math.max(1,numberEnv('ARTICLE_IMAGE_TEMPLATE_VERSION',2))
  }
};

export function getArticleConfig(){return ARTICLE_CONFIG}

export function articleConfigOverrides(){
  const names=['ARTICLE_AUTOMATION_ENABLED','ARTICLE_MAX_PER_DAY','ARTICLE_MIN_INTERVAL_MINUTES','ARTICLE_MIN_SEARCH_SCORE','ARTICLE_MIN_QUALITY_SCORE','ARTICLE_QSTASH_ENABLED','ARTICLE_RESEARCH_GROUNDING_ENABLED','ARTICLE_IMAGE_ENABLED','ARTICLE_IMAGE_PROVIDER','ARTICLE_IMAGE_MODEL','ARTICLE_IMAGE_ASPECT_RATIO','ARTICLE_IMAGE_WIDTH','ARTICLE_IMAGE_HEIGHT','ARTICLE_IMAGE_STORAGE','ARTICLE_IMAGE_FALLBACK','ARTICLE_IMAGE_DISCLOSURE','ARTICLE_IMAGE_TEMPLATE_VERSION'];
  return Object.fromEntries(names.filter(name=>process.env[name]!==undefined&&process.env[name]!=='').map(name=>[name,true]));
}
