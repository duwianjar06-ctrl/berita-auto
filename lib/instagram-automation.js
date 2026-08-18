import {getJson,setJson,sortedAdd,persistenceConfigured} from './persistence.js';

export const INSTAGRAM_AUTOMATION_SETTINGS_KEY='ba:social:instagram:automation:settings';
export const INSTAGRAM_AUTOMATION_AUDIT_INDEX='ba:social:instagram:automation:audit:index';
export const DEFAULT_AUTO_UPLOAD_ENABLED=false;
export const DEFAULT_AUTO_UPLOAD_INTERVAL_MINUTES=5;

export async function getInstagramAutomationSettings(){
  const stored=persistenceConfigured()?await getJson(INSTAGRAM_AUTOMATION_SETTINGS_KEY):null;
  return {autoUploadEnabled:stored?.autoUploadEnabled===true,autoUploadIntervalMinutes:DEFAULT_AUTO_UPLOAD_INTERVAL_MINUTES,updatedAt:stored?.updatedAt||null,updatedBy:stored?.updatedBy||null,source:stored?'persistent':'default'};
}

export async function setInstagramAutoUploadEnabled(enabled,{updatedBy=null}={}){
  if(!persistenceConfigured())throw new Error('persistence_not_configured');
  const current=await getInstagramAutomationSettings();
  const changedAt=new Date().toISOString();
  const next={...current,autoUploadEnabled:Boolean(enabled),updatedAt:changedAt,updatedBy:updatedBy||null,source:'persistent'};
  await setJson(INSTAGRAM_AUTOMATION_SETTINGS_KEY,next);
  const audit={changedAt,changedBy:updatedBy||null,oldValue:Boolean(current.autoUploadEnabled),newValue:Boolean(enabled),source:'admin_toggle'};
  const auditKey=`ba:social:instagram:automation:audit:${changedAt}:${Math.random().toString(36).slice(2,8)}`;
  await setJson(auditKey,audit);await sortedAdd(INSTAGRAM_AUTOMATION_AUDIT_INDEX,Date.parse(changedAt),auditKey);
  return next;
}

export async function getInstagramAutomationAudit(limit=20){if(!persistenceConfigured())return[];const keys=await import('./persistence.js').then(m=>m.sortedRange(INSTAGRAM_AUTOMATION_AUDIT_INDEX,0,Math.max(0,limit-1)));const rows=await Promise.all((keys||[]).map(key=>getJson(key)));return rows.filter(Boolean);}
