import assert from 'node:assert/strict';
import {selectPublication} from './strategy.js';
import {enrichArticle,DEFAULT_IMAGE_URL} from './image-enrichment.js';
import {filterByProcessingStatus,processingCounts,humanWarnings} from '../lib/admin-processing.js';
const originalFetch=globalThis.fetch;
try{
 const newest={fingerprint:'new',titleFingerprint:'new-title',title:'Berita terbaru',summary:'Ringkasan terbaru',publishedAt:'2026-08-16T00:30:00Z',category:'Teknologi',sourceName:'Source New'};
 const older={fingerprint:'old',titleFingerprint:'old-title',title:'Berita lama',summary:'Ringkasan lama',publishedAt:'2026-08-15T18:00:00Z',category:'Nasional',sourceName:'Source Old'};
 const chosen=selectPublication([older,newest],[],Date.parse('2026-08-16T00:31:00Z'));
 assert.equal(chosen.fingerprint,'new','newest valid candidate must win over enrichment/image preference');
 globalThis.fetch=async()=>new Response('not found',{status:404});
 const image=await enrichArticle({title:'Tanpa gambar',url:'https://example.com/article',imageUrl:null});
 assert.equal(image.status,'fallback');assert.equal(image.imageUrl,DEFAULT_IMAGE_URL);assert.equal(image.source,'fallback');
 const warningArticle={id:'a',publishStatus:'published',qualityStatus:'warning',publishWarnings:['missing_image','gemini_primary_failed','fallback_used'],paraphraseStatus:'fallback',translationStatus:'not_required'};
 const goodArticle={id:'b',publishStatus:'published',qualityStatus:'good',publishWarnings:[],paraphraseStatus:'success',translationStatus:'translated'};
 const counts=processingCounts([warningArticle,goodArticle]);assert.equal(counts.published,2);assert.equal(counts.warning,1);assert.equal(counts.paraphrase,1);assert.equal(counts.translation,1);assert.equal(filterByProcessingStatus([warningArticle,goodArticle],'warning').length,1);assert.deepEqual(humanWarnings(warningArticle),['Gambar sumber tidak tersedia.','Gemini Primary gagal memproses artikel.','Artikel diterbitkan menggunakan fallback.']);
 console.log('Publish-first regression: PASS newest-first image-fallback admin-warning');
}catch(error){console.error('Publish-first regression: FAIL',error);process.exitCode=1}finally{globalThis.fetch=originalFetch}
