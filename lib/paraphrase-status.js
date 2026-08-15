export function normalizeParaphraseStatus(article){
  if(!article||typeof article!=='object')return article;
  if(article.paraphraseStatus)return article;
  return article;
}

export function isParaphraseSuccess(article){return String(article?.paraphraseStatus||'').toLowerCase()==='success';}
