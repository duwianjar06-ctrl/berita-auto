const SUCCESS_PROVIDER_SET=new Set(['gemini','openai']);

export function normalizeParaphraseStatus(article){
  if(!article||typeof article!=='object')return article;
  if(article.paraphraseStatus)return article;
  const provider=String(article.generationProvider||'').trim().toLowerCase();
  if(!SUCCESS_PROVIDER_SET.has(provider))return article;
  return {...article,paraphraseStatus:'success'};
}

export function isParaphraseSuccess(article){return String(article?.paraphraseStatus||'').toLowerCase()==='success';}
