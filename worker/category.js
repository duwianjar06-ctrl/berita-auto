import {categories} from '../lib/categories.js';

const RULES={
  Politik:[/politik|dpr|dpd|mpr|partai|pemilu|pilkada|koalisi|legislasi politik|kabinet|menteri|kenegaraan|sidang tahunan|pidato kenegaraan|fraksi|pansus/gi,4],
  Olahraga:[/sepak bola|sepakbola|liga|pertandingan|pemain|pelatih|transfer|gol|bulutangkis|tenis|basket|atlet|olahraga|juara|persib|persija|pssi|futsal/gi,4],
  Otomotif:[/otomotif|mobil|motor|kendaraan|hybrid|mesin|toyota|honda|suzuki|yamaha|wuling|molinas|ev\b|kendaraan listrik/gi,4],
  Teknologi:[/teknologi|tekno|gadget|smartphone|aplikasi|software|artificial intelligence|kecerdasan buatan|internet|cyber|semikonduktor|semiconductor|platform teknologi/gi,4],
  Ekonomi:[/ekonomi|inflasi|pajak|rupiah|bank indonesia|suku bunga|ekspor|impor|investasi|perbankan|ihsg|bea keluar|cukai|emas antam|apbn|fiskal|moneter|pertumbuhan ekonomi|cadangan devisa/gi,4],
  Bisnis:[/bisnis|usaha|emiten|saham|perusahaan|korporasi|ritel|merger|akuisisi|pembiayaan|startup|umkm|pendapatan perusahaan|laba perusahaan|ekspansi/gi,4],
  Hiburan:[/hiburan|film|musik|aktor|aktris|artis|konser|selebritas|sinetron|netflix|streaming|penyanyi/gi,4],
  Lifestyle:[/gaya hidup|lifestyle|kuliner|fashion|wisata|travel|wellness|kesehatan sehari-hari|hubungan|resep|kopi|tips kesehatan/gi,4],
  Sains:[/sains|riset|penelitian|ilmiah|antariksa|astronomi|biologi|fisika|geologi|arkeologi|nasa|brin|malaria|kanker|seismik/gi,4],
  Internasional:[/amerika serikat|amerika|kanada|inggris|jepang|korea selatan|tiongkok|china|rusia|ukraina|eropa|uni eropa|timur tengah|israel|palestina|iran|irak|suriah|washington|beijing|moskwa|london|paris|tokyo|toronto|asean|dunia|perdagangan global/gi,5]
};
const DAERAH=/pemprov|pemkab|pemkot|bupati|wali kota|kabupaten|kecamatan|desa|kelurahan|pemerintah daerah|pemda|polda|polres|polsek|rumah sakit daerah|jalan .* (?:kabupaten|kota)|banjir .* (?:kabupaten|kota)|longsor .* (?:kabupaten|kota)/i;
const FEED_TOPIC=[['Olahraga',/olahraga|sepakbola|bola/i],['Otomotif',/otomotif|oto/i],['Teknologi',/tekno|teknologi/i],['Politik',/politik/i],['Ekonomi',/ekonomi|market|finance/i],['Bisnis',/bisnis/i],['Hiburan',/hiburan|entertainment|showbiz/i],['Lifestyle',/lifestyle|gaya hidup/i],['Sains',/sains|science/i],['Internasional',/dunia|internasional/i]];

export function classifyCategory(item){
  const explicit=String(item.category||'').trim();
  if(explicit&&categories.includes(explicit))return explicit;
  const source=String(item.sourceName||'');
  for(const [category,rule] of FEED_TOPIC)if(rule.test(source))return category;
  const text=`${item.title||''} ${item.summary||''} ${item.description||''}`;
  if(DAERAH.test(text))return 'Daerah';
  const lower=text.toLowerCase();
  const scores=Object.fromEntries(Object.keys(RULES).map(k=>[k,0]));
  for(const [category,[rule,weight]] of Object.entries(RULES)){const matches=lower.match(rule);scores[category]=(matches?matches.length:0)*weight;}
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
  return best&&best[1]>0&&categories.includes(best[0])?best[0]:(explicit||'Nasional');
}
