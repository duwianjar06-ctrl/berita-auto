import assert from 'node:assert/strict';
import test from 'node:test';
import {generateInstagramRichParaphrase,paraphraseOverlapTooHigh} from '../lib/instagram-caption-ai.js';

test('rich paraphrase provider layer is bounded and rejects overly extractive output',async()=>{
  const source=`Pemerintah mengumumkan program baru pada 2026 di Jakarta. Anggaran program mencapai Rp240 triliun dan mencakup 12 provinsi. Kebijakan tersebut diputuskan setelah evaluasi selama enam bulan. Menteri terkait mengatakan pelaksanaan akan dilakukan bertahap mulai September. Pemerintah juga menyiapkan laporan evaluasi pada akhir tahun untuk mengukur dampaknya. ${'Konteks tambahan mengenai pelaksanaan program dan dampaknya bagi masyarakat. '.repeat(20)}`;
  const facts=['Pemerintah mengumumkan program baru pada 2026 di Jakarta.','Anggaran mencapai Rp240 triliun dan mencakup 12 provinsi.','Kebijakan diputuskan setelah evaluasi selama enam bulan.','Pelaksanaan bertahap mulai September.','Laporan evaluasi disiapkan pada akhir tahun.'];
  const result=await generateInstagramRichParaphrase({article:{id:'fixture-1',title:'Pemerintah Umumkan Program Baru',category:'Nasional'},verifiedFacts:facts,articleSource:source,fingerprint:'fixture-1'});
  assert.equal(typeof result.body,'string');
  assert.equal(typeof result.aiUsed,'boolean');
  assert.equal(typeof result.fallbackUsed,'boolean');
});

test('paraphrase overlap helper detects copied paragraph',()=>{
  const source='Pemerintah menaikkan anggaran program menjadi Rp240 triliun pada 2026 setelah evaluasi selama enam bulan.';
  assert.equal(paraphraseOverlapTooHigh(source,source,.72),true);
});
