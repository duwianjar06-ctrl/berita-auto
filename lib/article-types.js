export const ARTICLE_TYPES=['GUIDE','HOW_TO','TROUBLESHOOTING','EXPLAINER','COMPARISON','MAINTENANCE','FAQ','CHECKLIST','EVERGREEN'];
export const ARTICLE_STATUSES=['IDEA','RESEARCHING','DRAFT','NEEDS_REVIEW','READY','PUBLISHED','UPDATE_EXISTING','SKIPPED','FAILED'];
export const ARTICLE_CATEGORIES=['Automotive','Technology','Public Utility','Lifestyle','Finance','Education','General'];
export function normalizeArticleType(value){const v=String(value||'').trim().toUpperCase();return ARTICLE_TYPES.includes(v)?v:'EVERGREEN'}
export function normalizeArticleStatus(value){const v=String(value||'').trim().toUpperCase();return v&&ARTICLE_STATUSES.includes(v)?v:'DRAFT'}
export function articleIsIndexable(article={}){return article.contentType==='article'&&article.status==='PUBLISHED'&&article.indexable!==false&&String(article.robots||'index, follow').toLowerCase().startsWith('index')&&/^https?:\/\//i.test(String(article.imageUrl||''))}
export function articleSchemaType(article={}){return article.articleType==='HOW_TO'&&Array.isArray(article.steps)&&article.steps.length?'HowTo':'Article'}
