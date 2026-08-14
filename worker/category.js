const RULES={
  Politik:[/politik|presiden|wakil presiden|dpr|dpd|mpr|partai|pemilu|pilkada|kabinet|menteri|gibran|kenegaraan|sidang tahunan|pidato kenegaraan/gi,4],
  Olahraga:[/sepak bola|sepakbola|liga|pertandingan|pemain|pelatih|transfer|gol|bulutangkis|tenis|basket|atlet|olahraga|juara|persib|persija|pssi/gi,4],
  Otomotif:[/otomotif|mobil|motor|kendaraan|maung|hybrid|mesin|toyota|honda|suzuki|yamaha|wuling|molinas/gi,4],
  Teknologi:[/teknologi|tekno|gadget|smartphone|aplikasi|software|artificial intelligence|kecerdasan buatan|internet|startup/gi,4],
  Ekonomi:[/ekonomi|inflasi|pajak|rupiah|bank indonesia|suku bunga|ekspor|impor|investasi|perbankan|ihsg|bea keluar|cukai|emas antam/gi,4],
  Bisnis:[/bisnis|usaha|emiten|saham|perusahaan|korporasi|ritel|merger|akuisisi|pembiayaan/gi,4],
  Hiburan:[/hiburan|film|musik|aktor|aktris|artis|konser|selebritas|sinetron|netflix/gi,4],
  Lifestyle:[/gaya hidup|lifestyle|kuliner|fashion|wisata|travel|wellness|diet/gi,4],
  Sains:[/sains|riset|penelitian|ilmiah|antariksa|lingkungan|iklim|nze|bumi|energi|brin/gi,4],
  Internasional:[/amerika serikat|amerika|kanada|inggris|jepang|korea selatan|tiongkok|china|rusia|ukraina|eropa|uni eropa|timur tengah|israel|palestina|iran|irak|suriah|washington|beijing|moskwa|london|paris|tokyo|toronto|asean|dunia|perdagangan global/gi,5],
};
const LOCAL=/polda|polisi|polres|polsek|pemprov|pemkab|pemkot|sar gabungan|petugas|harimau|jakarta|sumatra|sumatera|jawa|bali|papua|ntt|ntb|kalimantan|sulawesi/i;
const FEED_TOPIC=[['Olahraga',/olahraga|sepakbola/i],['Otomotif',/otomotif/i],['Teknologi',/tekno|teknologi/i],['Politik',/politik/i],['Ekonomi',/ekonomi/i],['Bisnis',/bisnis/i],['Hiburan',/hiburan|seni dan hiburan/i],['Lifestyle',/lifestyle|gaya hidup/i],['Sains',/warta bumi|sains/i],['Internasional',/dunia|internasional/i]];

export function classifyCategory(item){
  const source=String(item.sourceName||'');
  const explicit=String(item.category||'').trim();
  if(source!=='ANTARA Terkini'){
    for(const [category,rule] of FEED_TOPIC)if(rule.test(source))return category;
    return explicit||'Daerah';
  }
  const text=`${item.title||''} ${item.summary||''}`.toLowerCase();
  const scores=Object.fromEntries(Object.keys(RULES).map(k=>[k,0]));
  for(const [category,[rule,weight]] of Object.entries(RULES)){
    const matches=text.match(rule);
    scores[category]=(matches?matches.length:0)*weight;
  }
  if(LOCAL.test(text)){
    scores.Nasional+=3;
    scores.Internasional=Math.max(0,scores.Internasional-5);
  }
  if(/budaya politik|demokrasi|partai|dpr|dpd|mpr|presiden/i.test(text))scores.Politik+=6;
  if(/digital|era digital/i.test(text)&&!(/teknologi|gadget|software|smartphone|aplikasi|internet|startup/i.test(text)))scores.Teknologi=Math.max(0,scores.Teknologi-6);
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
  return best&&best[1]>0?best[0]:explicit||'Nasional';
}
