import {fetchNews} from '../lib/rss.js';
console.log(`fetched ${(await fetchNews()).length} news items`);
