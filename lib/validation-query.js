const GENERIC_TOKENS=new Set(['video','foto','breaking','update','terbaru','terkini','ini','begini','langsung','ternyata','resmi','adalah','yang','untuk','dari','dan','di','ke','pada','dengan','oleh','akan','bakal','bagi','para','ini']);
const OPERATOR_RE=/(?:site:|intitle:|inurl:|\bOR\b|["'+-])/gi;
const STOPWORDS=new Set(['kapan','dimana','mana','apa','bagaimana','mengapa','kenapa','apakah','hari','hariannya','hariini','hari ini','news','berita']);
const tokenize=s=>String(s||'').replace(/[“”‘’]/g,'').replace(/[.,!?;:()[\]{}]/g,' ').split(/\s+/).map(x=>x.trim()).filter(Boolean);
const cleanToken=s=>s.toLowerCase().replace(/[^a-z0-9-]/g,'');
const unique=a=>[...new Set(a.filter(Boolean))];

function entityTokens(article){
 const explicit=Array.isArray(article?.entities)?article.entities.flatMap(x=>typeof x==='string'?[x]:[x?.name,x?.value]):Object.values(article?.entities||{}).flatMap(v=>Array.isArray(v)?v:[v]);
 return unique(explicit.flatMap(tokenize));
}

function scoreToken(token,article){
 const t=cleanToken(token);if(!t||GENERIC_TOKENS.has(t)||STOPWORDS.has(t))return -100;
 let score=1;
 const entities=entityTokens(article).map(cleanToken);if(entities.includes(t))score+=8;
 if(/\d/.test(t))score+=5;
 if(/^(manggarai|ntt|kalimantan|jakarta|papua|jogja|bali|bandung|surabaya|indonesia)$/i.test(t))score+=5;
 if(/^(kemensos|kementerian|kemenpu|pge|brimob|bmkg|cpns|pertalite|atletico|malaga|barcelona|al|honda|samsung|trump|kim|jong|un)$/i.test(t))score+=4;
 if(String(article?.primaryQuery||article?.searchQuery||'').toLowerCase().includes(t))score+=2;
 if(t.length>=7)score+=1;
 return score;
}

export function buildArticleValidationQuery(article={}){
 const titleTokens=tokenize(article.title);
 const candidates=unique([...entityTokens(article),...titleTokens]);
 const ranked=candidates.map((token,index)=>({token,score:scoreToken(token,article),index})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
 const selected=[];for(const item of ranked){const t=item.token;if(selected.join(' ').length+t.length>92)continue;if(selected.some(x=>cleanToken(x)===cleanToken(t)))continue;selected.push(t);if(selected.length>=10)break;}
 let phrase=selected.join(' ').trim();
 if(!phrase){phrase=titleTokens.filter(t=>!GENERIC_TOKENS.has(cleanToken(t))).slice(0,8).join(' ').trim();}
 const brand='Berita Auto berita-auto.vercel.app';
 phrase=phrase.replace(OPERATOR_RE,' ').replace(/\s+/g,' ').trim();
 const query=`${phrase} ${brand}`.trim();
 return query;
}

export function validateArticleValidationQuery(query,article={}){
 const q=String(query||'').trim();
 const tokens=tokenize(q).map(cleanToken).filter(Boolean);
 const articleText=`${article.title||''} ${entityTokens(article).join(' ')}`.toLowerCase();
 const brand=q.toLowerCase().includes('berita auto')&&q.toLowerCase().includes('berita-auto.vercel.app');
 const operators=!OPERATOR_RE.test(q);
 OPERATOR_RE.lastIndex=0;
 const relevant=tokens.filter(t=>t!=='berita'&&t!=='auto'&&t!=='berita-auto-vercel-app').some(t=>articleText.includes(t));
 const uniqueness=new Set(tokens.filter(t=>t.length>=5)).size;
 const quality=Math.max(0,Math.min(100,(brand?30:0)+(operators?20:0)+(relevant?30:0)+Math.min(20,uniqueness*2)));
 return {valid:Boolean(q&&brand&&operators&&relevant),quality,uniqueness,brand,operators,relevant};
}

export function ensureArticleValidationQuery(article={}){
 const query=article.validationQuery||buildArticleValidationQuery(article);
 return {validationQuery:query,validationQueryQuality:validateArticleValidationQuery(query,article)};
}
