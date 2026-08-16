export function orderPreparationCandidates({freshCandidates=[],failedCandidates=[],maxAttempts=10,maxFailedRetries=2}={}){
  const limit=Math.max(1,Number(maxAttempts)||10);
  const failedLimit=Math.max(0,Math.min(limit,Number(maxFailedRetries)||2));
  const freshLimit=Math.max(0,limit-failedLimit);
  return [...freshCandidates.slice(0,freshLimit),...failedCandidates.slice(0,failedLimit)].slice(0,limit);
}
