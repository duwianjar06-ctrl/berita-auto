export function isSuccessfullyParaphrased(article){return String(article?.paraphraseStatus||'').trim().toLowerCase()==='success';}

export function isSuccessfullyTranslated(article){return String(article?.translationStatus||'').trim().toLowerCase()==='translated';}

export function processingCounts(articles=[]){return articles.reduce((counts,article)=>({paraphrase:counts.paraphrase+(isSuccessfullyParaphrased(article)?1:0),translation:counts.translation+(isSuccessfullyTranslated(article)?1:0)}),{paraphrase:0,translation:0});}

export function filterByProcessingStatus(articles=[],filter=''){if(filter==='paraphrase')return articles.filter(isSuccessfullyParaphrased);if(filter==='translated')return articles.filter(isSuccessfullyTranslated);return articles;}
