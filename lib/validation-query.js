const GENERIC_TOKENS=new Set(['video','foto','breaking','update','terbaru','terkini','ini','begini','langsung','ternyata','resmi','adalah','yang','untuk','dari','dan','di','ke','pada','dengan','oleh','akan','bakal','bagi','para']);
const OPERATOR_RE=/(?:\b(?:site|intitle|inurl):|\bOR\b|["'+]|\s-\s)/i;
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
 return `${phrase} ${brand}`.trim();
}

export function validateArticleValidationQuery(query,article={}){
 const q=String(query||'').trim();
 const tokens=tokenize(q).map(cleanToken).filter(Boolean);
 const articleText=`${article.title||''} ${entityTokens(article).join(' ')}`.toLowerCase();
 const lower=q.toLowerCase();
 const brand=lower.includes('berita auto')&&lower.includes('berita-auto.vercel.app');
 const operators=!OPERATOR_RE.test(q);
 const relevant=tokens.filter(t=>t!=='berita'&&t!=='auto'&&t!=='berita-auto-vercel-app').some(t=>articleText.includes(t));
 const uniqueness=new Set(tokens.filter(t=>t.length>=5)).size;
 const quality=Math.max(0,Math.min(100,(brand?30:0)+(operators?20:0)+(relevant?30:0)+Math.min(20,uniqueness*2)));
 return {valid:Boolean(q&&brand&&operators&&relevant),quality,uniqueness,brand,operators,relevant};
}

export function ensureArticleValidationQuery(article={}){
 const query=article.validationQuery||buildArticleValidationQuery(article);
 return {validationQuery:query,validationQueryQuality:validateArticleValidationQuery(query,article)};
}

const SEARCH_GENERIC=new Set(['video','foto','breaking','update','terbaru','terkini','ini','begini','langsung','ternyata','resmi','adalah','yang','untuk','dari','dan','di','ke','pada','dengan','oleh','akan','bakal','bagi','para','kapan','dimana','mana','apa','bagaimana','mengapa','kenapa','apakah','hari','hari ini','news','berita','penjelasan','bilang','kata','ungkap','ungkapnya']);
const SEARCH_LOCATION_RE=/^(ntt|manggarai|manggarai-timur|kalimantan|papua|jogja|yogyakarta|bali|bandung|surabaya|jakarta|indonesia|malang|malaysia|singapore)$/i;
const SEARCH_ORG_RE=/^(kemensos|kemenpupr|kementerian|pge|brimob|bmkg|cpns|pertalite|atletico|malaga|barcelona|honda|samsung|trump|kim|jong|un|pemerintah)$/i;
const searchToken=s=>String(s||'').replace(/[“”‘’]/g,'').replace(/[.,!?;:()[\]{}]/g,' ').split(/\s+/).map(x=>x.trim()).filter(Boolean);
const cleanSearch=s=>s.toLowerCase().replace(/[^a-z0-9-]/g,'');
const articleEntityValues=article=>{const raw=article?.entities;const vals=Array.isArray(raw)?raw.flatMap(x=>typeof x==='string'?[x]:[x?.name,x?.value]):Object.values(raw||{}).flatMap(v=>Array.isArray(v)?v:[v]);return unique(vals.flatMap(searchToken));};

export function buildArticleSearchQuery(article={}){
 const title=searchToken(article.title);
 const entities=articleEntityValues(article);
 const pool=unique([...entities,...title]);
 const ranked=pool.map((token,index)=>{const t=cleanSearch(token);let score=0;if(!t||SEARCH_GENERIC.has(t))return {token,score:-100,index};if(entities.some(e=>cleanSearch(e)===t))score+=10;if(/\d/.test(t))score+=5;if(SEARCH_LOCATION_RE.test(t))score+=6;if(SEARCH_ORG_RE.test(t))score+=6;if(token.length>=7)score+=2;if(/^[A-Z0-9][A-Za-z0-9-]*$/.test(token)&&/[A-Z]/.test(token))score+=2;return {token,score,index}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
 const selected=[];for(const item of ranked){const t=item.token;if(selected.length>=8)break;if(selected.some(x=>cleanSearch(x)===cleanSearch(t)))continue;selected.push(t);}
 let phrase=selected.join(' ').trim();
 if(!phrase){phrase=title.filter(t=>!SEARCH_GENERIC.has(cleanSearch(t))).slice(0,7).join(' ').trim();}
 if(!phrase){phrase=String(article?.primaryQuery||'').trim();}
 const result=unique(searchToken(phrase)).filter(t=>!SEARCH_GENERIC.has(cleanSearch(t))).slice(0,12).join(' ');
 return `${result} Berita Auto`.trim();
}

export function validateArticleSearchQuery(query,article={}){
 const q=String(query||'').trim();const lower=q.toLowerCase();const tokens=searchToken(q).map(cleanSearch).filter(Boolean);const articleText=`${article.title||''} ${articleEntityValues(article).join(' ')}`.toLowerCase();
 const brand=lower.includes('berita auto');const operators=!OPERATOR_RE.test(q);const relevant=tokens.some(t=>t!=='berita'&&t!=='auto'&&articleText.includes(t));const meaningful=tokens.filter(t=>t!=='berita'&&t!=='auto').length;const lengthOk=meaningful>=2&&meaningful<=12;return {valid:Boolean(q&&brand&&operators&&relevant&&lengthOk),brand,operators,relevant,lengthOk,meaningful};
}
