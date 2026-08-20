import {readSearchAnalytics,saveSearchAnalytics,parseSearchConsoleCsv} from './search-data.js';
export function getSearchAnalyticsProvider(){return process.env.GSC_SEARCH_ANALYTICS_PROVIDER==='api'?{name:'gsc_api',available:false,reason:'official API credentials are not configured'}:{name:'snapshot',available:true,read:readSearchAnalytics,save:saveSearchAnalytics,parseCsv:parseSearchConsoleCsv};}
