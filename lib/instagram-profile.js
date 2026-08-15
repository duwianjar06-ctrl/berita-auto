import {socialVisualProfile} from '../lib/social-visual.js';
const title='Berita Auto';
const bioVariants=[
  {style:'formal',text:'Berita terkini Indonesia & dunia. Ringkas, faktual, dan terpercaya. Baca selengkapnya di berita-auto.vercel.app'},
  {style:'modern-singkat',text:'📰 Berita hari ini, tanpa ribet. ⚡ Ringkas • aktual • faktual. 👇 berita-auto.vercel.app'},
  {style:'informatif-brand',text:'BERITA AUTO | Kabar terkini Indonesia & dunia. Update singkat, sumber jelas, langsung ke intinya. 👇 berita-auto.vercel.app'}
];
export const recommendedBio=bioVariants[2];
export const instagramBio={account:'@berita.auto',recommended:recommendedBio,variants:bioVariants,link:'https://berita-auto.vercel.app'};
export const profileConcepts=[
 {name:'BA Monogram',description:'Monogram BA putih di atas bidang biru tua, sederhana dan sangat terbaca pada ukuran avatar kecil.',recommended:true},
 {name:'News Broadcast',description:'Ikon bulletin/broadcast minimal dengan inisial BA, memberi kesan media berita modern.'},
 {name:'Wordmark Badge',description:'Badge lingkaran BERITA AUTO dengan aksen garis berita, lebih editorial dan mudah dikenali.'}
];
export function profileAssetSpec(){return{title,format:'SVG/PNG',recommended:'BA Monogram',size:'1080x1080',background:'#07111f',foreground:'#ffffff',accent:'#2563eb',safeArea:'15%',concepts:profileConcepts};}
export function profileVisualForArticle(article){return socialVisualProfile(article);}
