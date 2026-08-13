import {readArticles} from '../../../lib/storage.js';
export async function GET(){return Response.json(await readArticles());}
