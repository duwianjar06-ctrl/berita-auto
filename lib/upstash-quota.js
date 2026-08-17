export const UPSTASH_QUOTA_PARENT_CODE='UPSTASH_QUOTA_EXCEEDED';
export const UPSTASH_MONTHLY_REQUEST_LIMIT_CODE='UPSTASH_MONTHLY_REQUEST_LIMIT_EXCEEDED';
export const UPSTASH_DAILY_REQUEST_LIMIT_CODE='UPSTASH_DAILY_REQUEST_LIMIT_EXCEEDED';

function errorText(error){
  return String(error?.message??error??'');
}

export function classifyUpstashQuotaError(error){
  const message=errorText(error);
  if(/err\s+max\s+requests\s+limit\s+exceeded|\bmax\s+requests\s+limit\s+exceeded/i.test(message))return UPSTASH_MONTHLY_REQUEST_LIMIT_CODE;
  if(/err\s+max\s+daily\s+request\s+limit\s+exceeded|\bmax\s+daily\s+request\s+limit\s+exceeded/i.test(message))return UPSTASH_DAILY_REQUEST_LIMIT_CODE;
  if(error?.code===UPSTASH_MONTHLY_REQUEST_LIMIT_CODE||error?.code===UPSTASH_DAILY_REQUEST_LIMIT_CODE)return error.code;
  if(error?.code===UPSTASH_QUOTA_PARENT_CODE)return UPSTASH_QUOTA_PARENT_CODE;
  return null;
}

export function isUpstashQuotaError(error){
  return classifyUpstashQuotaError(error)!==null;
}

export function isPermanentUpstashQuotaError(error){
  const code=classifyUpstashQuotaError(error);
  return code===UPSTASH_MONTHLY_REQUEST_LIMIT_CODE||code===UPSTASH_DAILY_REQUEST_LIMIT_CODE||code===UPSTASH_QUOTA_PARENT_CODE;
}

export function qstashDeliveryInfo(request){
  const headers=request?.headers;
  const retriedRaw=headers?.get('Upstash-Retried');
  const retriedNumber=retriedRaw==null||retriedRaw===''?0:Number(retriedRaw);
  const retried=Number.isFinite(retriedNumber)?Math.max(0,retriedNumber):0;
  return {
    scheduleId:headers?.get('Upstash-Schedule-Id')||null,
    messageId:headers?.get('Upstash-Message-Id')||null,
    retried,
    delivery:retried>0?'QSTASH_RETRY_DELIVERY':'INITIAL_SCHEDULE_DELIVERY'
  };
}

export function logQstashDelivery(request,route){
  const info=qstashDeliveryInfo(request);
  console.log('[qstash-delivery]',JSON.stringify({route,...info}));
  return info;
}

export function qstashNonRetryableResponse(body){
  return new Response(JSON.stringify(body),{status:489,headers:{'Content-Type':'application/json','Upstash-NonRetryable-Error':'true','Cache-Control':'no-store'}});
}
