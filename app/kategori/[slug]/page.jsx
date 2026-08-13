import {readArticles} from '../../../lib/storage.js';
export const dynamic='force-dynamic';
export default async function CategoryPage({params}){const {slug}=await params;const wanted=slug.replace(/-/g,' ').toLowerCase();const items=(await readArticles()).filter(x=>(x.category||'').toLowerCase()===wanted);return <main className="container"><h1>{slug}</h1><section className="grid">{items.map(a=><article key={a.id}><h3>{a.title}</h3><p>{a.content}</p></article>)}</section></main>}
