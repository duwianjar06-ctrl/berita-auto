import {getJson,setJson,persistenceConfigured} from './persistence.js';

export const INSTAGRAM_AUTOMATION_SETTINGS_KEY='ba:social:instagram:automation:settings';
export const DEFAULT_AUTO_UPLOAD_ENABLED=false;
export const DEFAULT_AUTO_UPLOAD_INTERVAL_MINUTES=30;

export async function getInstagramAutomationSettings(){
  const stored=persistenceConfigured()?await getJson(INSTAGRAM_AUTOMATION_SETTINGS_KEY):null;
  return {
    autoUploadEnabled:stored?.autoUploadEnabled===true,
    autoUploadIntervalMinutes:Math.max(15,Number(stored?.autoUploadIntervalMinutes||DEFAULT_AUTO_UPLOAD_INTERVAL_MINUTES)),
    updatedAt:stored?.updatedAt||null,
    updatedBy:stored?.updatedBy||null
  };
}

export async function setInstagramAutoUploadEnabled(enabled,{updatedBy=null}={}){
  if(!persistenceConfigured())throw new Error('persistence_not_configured');
  const current=await getInstagramAutomationSettings();
  const next={...current,autoUploadEnabled:Boolean(enabled),updatedAt:new Date().toISOString(),updatedBy:updatedBy||null};
  await setJson(INSTAGRAM_AUTOMATION_SETTINGS_KEY,next);
  return next;
}
