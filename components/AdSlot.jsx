export default function AdSlot({variant='leaderboard',placement='',className=''}){
  const link='https://wa.me/628515793801?text=Halo%20Berita%20Auto%2C%20saya%20tertarik%20memasang%20iklan%20di%20Berita%20Auto.';
  const copy={
    leaderboard:{title:'Jangkau lebih banyak pembaca bersama Berita Auto',text:'Promosikan brand, produk, layanan, bisnis, atau event Anda melalui ruang iklan Berita Auto.'},
    rectangle:{title:'Promosikan brand atau layanan Anda',text:'Hadir di sekitar pembaca yang sedang mengikuti perkembangan berita terbaru.'},
    inArticle:{title:'Perkenalkan brand Anda di tengah alur baca',text:'Ruang iklan yang ringkas untuk hadir tanpa mengganggu pengalaman membaca.'},
    footer:{title:'Hadirkan brand Anda di hadapan pembaca Berita Auto',text:'Bangun jangkauan dengan ruang iklan yang tampil selaras dengan pengalaman editorial.'}
  }[variant]||{title:'Jangkau pembaca Berita Auto',text:'Promosikan brand atau layanan Anda.'};
  return <aside className={`ad-slot ad-slot-${variant} ${className}`.trim()} data-placement={placement} aria-label="Iklan Berita Auto">
    <div className="ad-slot-content">
      <span className="ad-slot-kicker">IKLAN</span>
      <strong>{copy.title}</strong>
      <p>{copy.text}</p>
      <a href={link} target="_blank" rel="noopener noreferrer">Pasang Iklan ↗</a>
    </div>
    <div className="ad-slot-art" aria-hidden="true">
      <span className="ad-slot-orb"/>
      <span className="ad-slot-sheet ad-slot-sheet-a"/>
      <span className="ad-slot-sheet ad-slot-sheet-b"/>
      <span className="ad-slot-spark"/>
    </div>
  </aside>;
}
