import {persistenceConfigured,listPushJson,listRangeJson} from './persistence.js';

const KEY='ba:article:automation:runs';
const MAX_RUNS=20;

export async function recordArticleAutomationRun(input={}){const run={runId:String(input.runId||crypto.randomUUID()),startedAt:input.startedAt||new Date().toISOString(),finishedAt:input.finishedAt||new Date().toISOString(),trigger:input.trigger||'unknown',mode:input.mode||'auto',status:String(input.status||'failed').toUpperCase(),reason:input.reason||null,candidateCount:Number(input.candidateCount||0),candidateSources:Array.isArray(input.candidateSources)?input.candidateSources.slice(0,20):[],selectedTopic:input.selectedTopic||null,selectedPrimaryQuery:input.selectedPrimaryQuery||null,searchScore:input.searchScore??null,researchSourceCount:Number(input.researchSourceCount||0),qualityScore:input.qualityScore??null,imageStatus:input.imageStatus||null,finalArticleStatus:input.finalArticleStatus||null,articleId:input.articleId||null,slug:input.slug||null,schedulerReceived:Boolean(input.schedulerReceived)};
  if(persistenceConfigured()){await listPushJson(KEY,run);const rows=await listRangeJson(KEY,0,MAX_RUNS-1);if(rows.length>MAX_RUNS){/* list is bounded by trim below */}const {commandTrim}=await import('./article-automation-telemetry-trim.js').catch(()=>({}));if(commandTrim)await commandTrim(KEY,MAX_RUNS)}
  return run;
}
export async function listArticleAutomationRuns(limit=20){if(!persistenceConfigured())return[];return listRangeJson(KEY,0,Math.max(0,Math.min(MAX_RUNS,Number(limit)||20)-1))}
export function articleAutomationTelemetryConfigured(){return persistenceConfigured()}
