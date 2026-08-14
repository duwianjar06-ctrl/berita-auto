export default function AdSlot({variant='leaderboard',placement='',className=''}){
  const link='https://wa.me/628515793801?text=Halo%20Berita%20Auto%2C%20saya%20tertarik%20memasang%20iklan%20di%20Berita%20Auto.';
  const title=variant==='footer'?'Pasang Iklan di Berita Auto':'Ruang Iklan';
  return <aside className={`ad-slot ad-slot-${variant} ${className}`.trim()} aria-label="Iklan Berita Auto">
    <div className="ad-slot-content">
      <span className="ad-slot-kicker">IKLAN</span>
      <strong>{title}</strong>
      <p>{variant==='footer'?'Jangkau pembaca Berita Auto untuk promosi produk dan layanan Anda.':'Promosikan bisnis Anda kepada pembaca Berita Auto.'}</p>
      <small>08515793801</small>
      <a href={link} target="_blank" rel="noopener noreferrer">{placement==='footer'?'Hubungi Tim Iklan':'Pasang Iklan'} ↗</a>
    </div>
  </aside>;
}
