import {findArticle} from '../../../../lib/article-storage.js';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function ArticlePreview({params}){const a=await findArticle((await params).id);if(!a)return <main style={{padding:40}}>Artikel tidak ditemukan.</main>;return <main style={{maxWidth:820,margin:'40px auto',padding:20}}><p>PREVIEW · NOINDEX</p><h1>{a.title}</h1><p>{a.excerpt}</p><pre style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{a.content||'Draft belum memiliki content.'}</pre></main>}
