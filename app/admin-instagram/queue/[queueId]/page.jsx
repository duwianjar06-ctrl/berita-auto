import Link from 'next/link';
import {auth} from '../../../../auth.js';
import {getJson,setMembers,mgetJson} from '../../../../lib/persistence.js';
import {INSTAGRAM_PUBLISH_QUEUE_INDEX} from '../../../../lib/instagram-publish-queue.js';
import {humanizeInstagramMetaError,latestAttempt} from '../../../../lib/instagram-publisher-observability.js';

const REVIEW_ITEM=id=>`ba:social:instagram:review:item:${id}`;

async function getItem(queueId){
  const direct=await getJson(REVIEW_ITEM(queueId));
  if(direct)return direct;
  const keys=await setMembers(INSTAGRAM_PUBLISH_QUEUE_INDEX);
  if(!keys.length)return null;
  const rows=await mgetJson(keys);
  return rows.find(row=>String(row?.queueId||row?.id||'')===String(queueId))||null;
}

function fmt(value){return value?new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}):'Belum tercatat'}

export const dynamic='force-dynamic';
export default async function InstagramQueueDetailPage({params}){
  let session=null;try{session=await auth()}catch{}
  const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  if(!session?.user?.email||!allowed.includes(session.user.email.trim().toLowerCase()))return <main className="ig-shell"><section className="ig-panel"><h1>Akses ditolak</h1><p>Halaman ini hanya tersedia untuk administrator.</p></section></main>;
  const {queueId}=await params;
  const item=await getItem(queueId);
  if(!item)return <main className="ig-shell"><section className="ig-panel"><Link href="/admin-instagram/queue">← Kembali ke Antrean</Link><h1>Antrean tidak ditemukan</h1><p>ID: {queueId}</p></section></main>;
  const attempt=latestAttempt(item);
  const history=(Array.isArray(item.publishAttemptHistory)?item.publishAttemptHistory:[]).slice().reverse().slice(0,50);
  const meta=humanizeInstagramMetaError({metaCode:item.lastMetaErrorCode??attempt?.metaCode,metaSubcode:item.lastMetaErrorSubcode??attempt?.metaSubcode,message:item.lastFailureMessage||attempt?.safeMessage||attempt?.message,httpStatus:item.lastHttpStatus??attempt?.httpStatus});
  return <main className="ig-shell"><div className="ig-main-container"><section className="ig-page-header"><div className="ig-page-header-copy"><span className="ig-kicker">INSTAGRAM QUEUE</span><h1>Detail Antrean Instagram</h1><p>{String(item.title||'Berita').slice(0,180)}</p></div><div className="ig-page-header-actions"><Link href="/admin-instagram/queue">← Kembali</Link><Link href="/admin-instagram">Instagram Automation</Link></div></section>
    <section className="ig-panel"><div className="ig-detail-grid"><div><b>Status</b><span>{String(item.status||'UNKNOWN')}</span></div><div><b>Posisi</b><span>{item.position||'—'}</span></div><div><b>Prioritas</b><span>{Number(item.priority||0)}</span></div><div><b>Masuk antrean</b><span>{fmt(item.queuedAt||item.createdAt)}</span></div><div><b>Percobaan</b><span>{Number(item.publishAttemptCount||item.attempts||0)}</span></div><div><b>Percobaan terakhir</b><span>{fmt(item.lastPublishAttemptAt||attempt?.finishedAt)}</span></div><div><b>Percobaan berikutnya</b><span>{fmt(item.nextPublishAttemptAt||item.estimatedResumeAt)}</span></div><div><b>Masuk melalui</b><span>{item.queuedBy||'Tidak tercatat'}</span></div></div></section>
    <section className="ig-panel"><span className="ig-kicker">HASIL TERAKHIR</span><h2>{meta.headline}</h2><p>{meta.message}</p><dl className="ig-technical-grid"><div><dt>Tahap</dt><dd>{item.lastFailureStage||attempt?.stage||'Belum tercatat'}</dd></div><div><dt>Hasil</dt><dd>{item.lastAttemptResult||attempt?.outcome||attempt?.status||'Belum pernah diproses publisher'}</dd></div><div><dt>HTTP</dt><dd>{meta.technical.httpStatus||'—'}</dd></div><div><dt>Meta</dt><dd>{meta.technical.metaCode?`${meta.technical.metaCode} / ${meta.technical.metaSubcode||'—'}`:'—'}</dd></div></dl><details><summary>Detail Teknis</summary><pre>{JSON.stringify({code:item.lastFailureCode||null,stage:item.lastFailureStage||attempt?.stage||null,httpStatus:meta.technical.httpStatus,metaCode:meta.technical.metaCode,metaSubcode:meta.technical.metaSubcode,rawSafeMessage:meta.technical.rawMessage||null},null,2)}</pre></details></section>
    <section className="ig-panel"><span className="ig-kicker">RIWAYAT PERCOBAAN</span><h2>{history.length} percobaan terakhir</h2>{history.length?<div className="ig-attempt-list">{history.map((entry,index)=><article key={`${entry.attempt||index}-${entry.startedAt||index}`} className="ig-attempt"><div><strong>#{entry.attempt||history.length-index}</strong><span>{fmt(entry.finishedAt||entry.startedAt)}</span></div><b>{entry.status||entry.outcome||'UNKNOWN'}</b><p>{entry.stage||'UNKNOWN_STAGE'}{entry.operation?` · ${entry.operation}`:''}</p><p>{entry.safeMessage||entry.message||entry.reason||'Tidak ada pesan'}</p>{entry.metaCode?<small>HTTP {entry.httpStatus||'—'} · Meta {entry.metaCode} / {entry.metaSubcode||'—'}</small>:null}</article>)}</div>:<p>Belum ada riwayat percobaan yang tersimpan.</p>}</section>
    <section className="ig-panel"><span className="ig-kicker">MEDIA</span><div className="ig-media-list">{(Array.isArray(item.cardUrls)?item.cardUrls:[]).map((url,index)=><a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">Slide {index+1} · {String(url).replace(/^https?:\/\//,'').slice(0,100)}</a>)}</div></section>
  </div></main>
}
