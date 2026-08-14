export const NEWS_SOURCES=[
  {id:'antara-terkini',publisher:'ANTARA',name:'ANTARA Terkini',url:'https://www.antaranews.com/rss/terkini.xml',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'liputan6-news',publisher:'Liputan6',name:'Liputan6 News',url:'https://feed.liputan6.com/rss/news',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'cnn-indonesia-nasional',publisher:'CNN Indonesia',name:'CNN Indonesia Nasional',url:'https://www.cnnindonesia.com/nasional/rss',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'cnbc-indonesia-news',publisher:'CNBC Indonesia',name:'CNBC Indonesia News',url:'https://www.cnbcindonesia.com/news/rss',category:'Ekonomi',weight:1,enabled:true,language:'id'},
  {id:'media-indonesia',publisher:'Media Indonesia',name:'Media Indonesia',url:'https://mediaindonesia.com/feed',category:'Nasional',weight:1,enabled:true,language:'id'},
  {id:'tribunnews',publisher:'Tribunnews',name:'Tribunnews',url:'https://www.tribunnews.com/rss',category:'Nasional',weight:1,enabled:true,language:'id'}
];

export const sources=NEWS_SOURCES.filter(source=>source.enabled);
