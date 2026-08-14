import {extraSources} from './sources-extra.js';
const core=[
  {name:'ANTARA Terkini',url:'https://www.antaranews.com/rss/terkini.xml',category:'Nasional'},
  {name:'ANTARA Politik',url:'https://www.antaranews.com/rss/politik.xml',category:'Politik'},
  {name:'ANTARA Ekonomi',url:'https://www.antaranews.com/rss/ekonomi.xml',category:'Ekonomi'},
  {name:'ANTARA Bisnis',url:'https://www.antaranews.com/rss/ekonomi-bisnis.xml',category:'Bisnis'},
  {name:'ANTARA Dunia',url:'https://www.antaranews.com/rss/dunia.xml',category:'Internasional'},
  {name:'ANTARA Tekno',url:'https://www.antaranews.com/rss/tekno.xml',category:'Teknologi'},
  {name:'ANTARA Lifestyle',url:'https://www.antaranews.com/rss/lifestyle.xml',category:'Lifestyle'},
  {name:'ANTARA Hiburan',url:'https://www.antaranews.com/rss/hiburan.xml',category:'Hiburan'},
  {name:'ANTARA Olahraga',url:'https://www.antaranews.com/rss/olahraga.xml',category:'Olahraga'},
  {name:'ANTARA Sepakbola',url:'https://www.antaranews.com/rss/sepakbola.xml',category:'Olahraga'},
  {name:'ANTARA Otomotif',url:'https://www.antaranews.com/rss/otomotif.xml',category:'Otomotif'},
  {name:'ANTARA Warta Bumi',url:'https://www.antaranews.com/rss/warta-bumi.xml',category:'Sains'}
];
export const sources=[...core,...extraSources];
