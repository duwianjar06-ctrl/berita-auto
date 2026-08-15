import {getActiveAd} from '../lib/ads.js';

const FALLBACK_LINK='https://wa.me/628515793801?text=Halo%20Berita%20Auto%2C%20saya%20tertarik%20memasang%20iklan%20di%20Berita%20Auto.';
const copy={
  leaderboard:{title:'Jangkau lebih banyak pembaca bersama Berita Auto',text:'Promosikan brand, produk, layanan, bisnis, atau event Anda melalui ruang iklan Berita Auto.'},
  rectangle:{title:'Promosikan brand atau layanan Anda',text:'Hadir di sekitar pembaca yang sedang mengikuti perkembangan berita terbaru.'},
  inArticle:{title:'Perkenalkan brand Anda di tengah alur baca',text:'Ruang iklan yang ringkas untuk hadir tanpa mengganggu pengalaman membaca.'},
  footer:{title:'Hadirkan brand Anda di hadapan pembaca Berita Auto',text:'Bangun jangkauan dengan ruang iklan yang tampil selaras dengan pengalaman editorial.'}
};

export default async function AdSlot({variant='leaderboard',placement='',className='',enabled=true}){
  if(enabled===false)return null;
  const fallback=copy[variant]||{title:'Jangkau pembaca Berita Auto',text:'Promosikan brand atau layanan Anda.'};
  let ad=null;
  try{ad=placement?await getActiveAd(placement):null}catch{}
  if(ad)return <aside className={`ad-slot ad-slot-${variant} ad-slot-managed ${className}`.trim()} data-placement={placement} aria-label={`Iklan: ${ad.title}`}>
    <a className="ad-slot-managed-link" href={ad.targetUrl} target={ad.targetUrl.startsWith('/')?'_self':'_blank'} rel={ad.targetUrl.startsWith('/')?'sponsored':'noopener noreferrer sponsored'} aria-label={ad.title}>
      <img className="ad-slot-managed-image" src={ad.imageUrl} alt={ad.altText||ad.title} loading="lazy"/>
    </a>
  </aside>;
  return <aside className={`ad-slot ad-slot-${variant} ${className}`.trim()} data-placement={placement} aria-label="Iklan Berita Auto">
    <div className="ad-slot-content">
      <span className="ad-slot-kicker">IKLAN</span>
      <strong>{fallback.title}</strong>
      <p>{fallback.text}</p>
      <a href={FALLBACK_LINK} target="_blank" rel="noopener noreferrer sponsored">Pasang Iklan ↗</a>
    </div>
  </aside>;
}
