export const NEWS_SOURCES=[
  {id:'antara-terkini',publisher:'ANTARA',name:'ANTARA Terkini',url:'https://www.antaranews.com/rss/terkini.xml',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'liputan6-news',publisher:'Liputan6',name:'Liputan6 News',url:'https://feed.liputan6.com/rss/news',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'cnn-indonesia-nasional',publisher:'CNN Indonesia',name:'CNN Indonesia Nasional',url:'https://www.cnnindonesia.com/nasional/rss',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'cnbc-indonesia-news',publisher:'CNBC Indonesia',name:'CNBC Indonesia News',url:'https://www.cnbcindonesia.com/news/rss',category:'Ekonomi',weight:1,enabled:true,language:'id'},
  {id:'media-indonesia',publisher:'Media Indonesia',name:'Media Indonesia',url:'https://mediaindonesia.com/feed',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'tribunnews',publisher:'Tribunnews',name:'Tribunnews',url:'https://www.tribunnews.com/rss',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'deutsche-welle-en',publisher:'Deutsche Welle',name:'DW English News',url:'https://rss.dw.com/rdf/rss-en-all',category:'Internasional',weight:1,enabled:true,language:'en'},
  {id:'nasa-breaking-news',publisher:'NASA',name:'NASA Breaking News',url:'https://www.nasa.gov/rss/dyn/breaking_news.rss',category:'Sains',weight:0.9,enabled:true,language:'en'},
  {id:'jpl-cneos-news',publisher:'NASA JPL',name:'JPL CNEOS News',url:'https://cneos.jpl.nasa.gov/feed/news.xml',category:'Sains',weight:0.8,enabled:true,language:'en'},
  {id:'noaa-nhc-alerts',publisher:'NOAA NHC',name:'NHC Tropical Cyclone Updates',url:'https://www.nhc.noaa.gov/index-at.xml',category:'Internasional',weight:0.7,enabled:true,language:'en'},
  {id:'techcrunch-latest',publisher:'TechCrunch',name:'TechCrunch Latest',url:'https://techcrunch.com/feed/',category:'Teknologi',weight:0.9,enabled:true,language:'en'},
  {id:'the-verge-latest',publisher:'The Verge',name:'The Verge Latest',url:'https://www.theverge.com/rss/index.xml',category:'Teknologi',weight:0.9,enabled:true,language:'en'}
];

export const sources=NEWS_SOURCES.filter(source=>source.enabled);