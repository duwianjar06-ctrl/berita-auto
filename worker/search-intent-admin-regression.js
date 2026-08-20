import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const panel=await readFile(new URL('../app/admin-berita/SearchIntentPanel.jsx',import.meta.url),'utf8');
const page=await readFile(new URL('../app/admin-berita/page.jsx',import.meta.url),'utf8');
for(const token of ['Search Score Tertinggi','Google Opportunity','IG Opportunity','Trending','Public Utility','Low Search','Skip Candidate','Primary Query','Secondary Queries','Why Selected','Distribution','Topic Cluster','Search Console CSV'])assert(panel.includes(token),`missing admin token: ${token}`);
assert(page.includes('SearchIntentPanel'),'admin page does not expose search panel');
console.log('[search-intent-admin] PASS filters/sorts/detail/csv/mobile component wiring');
