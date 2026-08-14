const STRONG_RULES=[
  ['Olahraga',/sepak bola|sepakbola|liga|pertandingan|pemain|pelatih|transfer|gol|bulutangkis|tenis|basket|atlet|olahraga|juara|persib|persija|pssi/i],
  ['Otomotif',/otomotif|mobil|motor|kendaraan|maung|hybrid|listrik|mesin|toyota|honda|suzuki|yamaha|wuling|molinas/i],
  ['Teknologi',/teknologi|tekno|gadget|smartphone|aplikasi|software|artificial intelligence|kecerdasan buatan|internet|startup|digital/i],
  ['Politik',/politik|presiden|wakil presiden|dpr|dpd|mpr|partai|pemilu|pilkada|kabinet|menteri|gibran|kenegaraan|sidang tahunan|pidato kenegaraan/i],
  ['Ekonomi',/ekonomi|inflasi|pajak|rupiah|bank indonesia|suku bunga|ekspor|impor|investasi|perbankan|ihsg|bea keluar|cuk*i|emas antam/i],
  ['Bisnis',/bisnis|usaha|emiten|saham|perusahaan|korporasi|pasar|ritel|merger|akuisisi/i],
  ['Hiburan',/hiburan|film|musik|aktor|aktris|artis|konser|selebritas|sinetron|netflix/i],
  ['Lifestyle',/gaya hidup|lifestyle|kuliner|fashion|wisata|travel|wellness|diet|kesehatan/i],
  ['Sains',/sains|riset|penelitian|ilmiah|antariksa|lingkungan|iklim|nze|bumi|energi|brin/i],
];
const INTERNATIONAL=/amerika serikat|amerika|kanada|inggris|jepang|korea selatan|tiongkok|china|rusia|ukraina|eropa|uni eropa|timur tengah|israel|palestina|iran|irak|suriah|washington|beijing|moskwa|london|paris|tokyo|toronto/i;
const LOCAL=/polda|polisi|polres|polsek|pemprov|pemkab|pemkot|satuan polisi|sar gabungan|petugas|harimau|jakarta|sumatra|sumatera|jawa|bali|papua|ntt|ntb|kalimantan|sulawesi/i;
const FEED_TOPIC=[['Olahraga',/olahraga|sepakbola/i],['Otomotif',/otomotif/i],['Teknologi',/tekno|teknologi/i],['Politik',/politik/i],['Ekonomi',/ekonomi/i],['Bisnis',/bisnis/i],['Hiburan',/hiburan|seni dan hiburan/i],['Lifestyle',/lifestyle/i],['Sains',/warta bumi|sains/i],['Internasional',/internasional|dunia/i]];
export function classifyCategory(item){
  const source=String(item.sourceName||'');
  const explicit=String(item.category||'').trim();
  if(source!=='ANTARA Terkini'){
    for(const [category,rule] of FEED_TOPIC)if(rule.test(source))return category;
    return explicit||'Daerah';
  }
  const text=`${item.title||''} ${item.summary||''}`;
  if(INTERNATIONAL.test(text)&&!LOCAL.test(text))return 'Internasional';
  for(const [category,rule] of STRONG_RULES)if(rule.test(text))return category;
  if(LOCAL.test(text))return 'Nasional';
  return explicit||'Nasional';
}
