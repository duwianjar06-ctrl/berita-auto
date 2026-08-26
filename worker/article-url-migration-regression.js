import assert from 'node:assert/strict';
import {classifyUrl} from '../lib/article-image-migration.js';
import {repairReadyInstagramItem,migrateReadyInstagramItems} from '../lib/instagram-ready-url-migration.js';

const legacy='https://berita-auto.vercel.app';
const modern='https://berita-auto-olive.vercel.app';
assert.equal(classifyUrl(`${legacy}/api/article-image-fallback/a?v=3`),'LEGACY_DYNAMIC_FALLBACK');
assert.equal(classifyUrl('https://foo.public.blob.vercel-storage.com/a.jpg'),'VALID_BLOB');
assert.equal(classifyUrl('https://images.example.com/a.jpg'),'VALID_EXTERNAL_IMAGE');
assert.equal(classifyUrl(''),'MISSING_IMAGE');

const ready={id:'ready-1',articleId:'ready-1',status:'READY',postedAt:null,mediaId:null,removedAt:null,canonicalUrl:`${legacy}/berita/test`,articleUrl:`${legacy}/berita/test`,previewUrl:`${legacy}/api/social-card/ready-1?slide=1`,cardUrls:[`${legacy}/api/social-card/ready-1?slide=1`,'https://foo.public.blob.vercel-storage.com/card.jpg'],caption:`Baca berita: ${legacy}/berita/test`,captionBody:`Baca berita: ${legacy}/berita/test`,captionOriginal:`Baca berita: ${legacy}/berita/test`,title:'Tetap',hashtags:['#tetap']};
const first=repairReadyInstagramItem(ready);
assert.equal(first.changed,true);
assert.match(first.item.canonicalUrl,new RegExp(`^${modern}`));
assert.match(first.item.caption,new RegExp(`^Baca berita: ${modern}`));
assert.equal(first.item.cardUrls[1],'https://foo.public.blob.vercel-storage.com/card.jpg');
const second=migrateReadyInstagramItems([first.item],{dryRun:true});
assert.equal(second.wouldRepair,0);
const published={...ready,status:'PUBLISHED',postedAt:'2026-01-01T00:00:00.000Z'};
const publishedCheck=migrateReadyInstagramItems([published],{dryRun:true});
assert.equal(publishedCheck.scanned,0);
console.log('article/instagram URL migration regression: PASS');
