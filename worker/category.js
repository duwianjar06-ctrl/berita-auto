const RULES=[
  ['Olahraga',/sepak bola|sepakbola|liga|pertandingan|pemain|pelatih|transfer|gol|bulutangkis|tenis|basket|atlet|olahraga|juara/i],
  ['Otomotif',/otomotif|mobil|motor|kendaraan|maung|hybrid|listrik|mesin|toyota|honda|suzuki|yamaha|wuling/i],
  ['Teknologi',/teknologi|tekno|gadget|smartphone|aplikasi|software|ai|artificial intelligence|internet|startup|digital/i],
  ['Ekonomi',/ekonomi|inflasi|pajak|rupiah|bank indonesia|suku bunga|ekspor|impor|investasi|perbankan/i],
  ['Bisnis',/bisnis|usaha|emiten|saham|perusahaan|korporasi|pasar|ritel|startup/i],
  ['Politik',/politik|presiden|wakil presiden|dpr|mpr|partai|pemilu|pilkada|kabinet|menteri/i],
  ['Hiburan',/hiburan|film|musik|aktor|aktris|artis|konser|selebritas|sinetron/i],
  ['Lifestyle',/gaya hidup|lifestyle|kuliner|fashion|wisata|travel|kesehatan|wellness/i],
  ['Sains',/sains|riset|penelitian|ilmiah|antariksa|lingkungan|iklim|nze|bumi|energi/i],
  ['Internasional',/internasional|dunia|amerika|eropa|asia|timur tengah|ukraina|rusia|china|tiongkok/i],
];
export function classifyCategory(item){
  const source=String(item.sourceName||'');
  const explicit=String(item.category||'').trim();
  if(explicit&&source!=='ANTARA Terkini')return explicit;
  const text=`${item.title||''} ${item.summary||''} ${source}`;
  if(/\b(jakarta|jogja|yogyakarta|jawa tengah|jawa barat|jawa timur|sumatera|kalimantan|sulawesi|bali|papua)\b/i.test(text)&&/ANTARA (Jogja|Jateng|Jabar|Jatim|Lampung|Sumbar|Riau|Bali|Kalbar)/i.test(source))return 'Daerah';
  for(const [category,rule] of RULES)if(rule.test(text))return category;
  return explicit||'Nasional';
}
