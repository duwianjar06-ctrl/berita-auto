import {unstable_cache} from 'next/cache';
import {readArticles} from './storage.js';

const readCachedArticles=unstable_cache(
  async()=>readArticles(),
  ['berita-auto-public-articles'],
  {revalidate:10}
);

export async function readPublicArticles(){return readCachedArticles();}
