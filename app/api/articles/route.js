import {readArticles} from '../../../lib/storage.js';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await readArticles(),{headers:{'Cache-Control':'no-store, max-age=0'}});}
