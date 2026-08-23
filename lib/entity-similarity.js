export function entityList(value){
  if(Array.isArray(value))return value.flatMap(entityList);
  if(value&&typeof value==='object')return Object.values(value).flatMap(entityList);
  const item=String(value??'').trim();
  return item?[item]:[];
}

export function similarity(a,b){
  let score=0;
  if(a?.topicCluster&&b?.topicCluster&&a.topicCluster===b.topicCluster)score+=50;
  if(a?.category&&b?.category&&String(a.category).toLowerCase()===String(b.category).toLowerCase())score+=20;
  const entities=new Set(entityList(a?.entities??a?.entityNames).map(x=>x.toLowerCase()));
  for(const entity of entityList(b?.entities??b?.entityNames))if(entities.has(entity.toLowerCase()))score+=12;
  return score;
}
