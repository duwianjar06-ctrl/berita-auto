import assert from 'node:assert/strict';

process.env.UPSTASH_REDIS_REST_URL='https://unit.test';
process.env.UPSTASH_REDIS_REST_TOKEN='unit-test-token';

const commands=[];
globalThis.fetch=async(_url,options)=>{
  const args=JSON.parse(options.body);commands.push(args);
  const op=String(args[0]||'').toUpperCase();
  if(op==='MGET')return new Response(JSON.stringify({result:Array(Math.max(0,args.length-1)).fill(null)}),{status:200,headers:{'content-type':'application/json'}});
  if(op==='MSET'||op==='ZADD')return new Response(JSON.stringify({result:'OK'}),{status:200,headers:{'content-type':'application/json'}});
  throw new Error(`unexpected redis command ${op}`);
};

const {queueSocialArticles}=await import('../lib/social-queue-batch.js');
const articles=Array.from({length:20},(_,i)=>({id:`article-${i}`,sitePublishedAt:new Date(Date.now()-i*60000).toISOString(),title:`Article ${i}`,category:'Nasional'}));
await queueSocialArticles(articles);

const reads=commands.filter(args=>['GET','MGET','HGET','HGETALL','SMEMBERS','SCARD','LRANGE','ZREVRANGE','EXISTS','TTL'].includes(String(args[0]).toUpperCase()));
const writes=commands.filter(args=>['SET','MSET','DEL','SADD','SREM','ZADD','LPUSH','LTRIM'].includes(String(args[0]).toUpperCase()));
assert.equal(reads.length,1,'batch social admission must use one Redis read');
assert.equal(reads[0][0],'MGET');
assert.equal(writes.filter(args=>args[0]==='MSET').length,1,'batch admission must use one MSET');
assert.equal(writes.filter(args=>args[0]==='ZADD').length,20,'each sorted queue member remains a real Redis write; no fake command-count compression');
assert.equal(commands.length,22,'20-item batch must execute 1 MGET + 1 MSET + 20 ZADD commands');
console.log(JSON.stringify({flow:'social_queue_batch_admission',items:20,redisReads:reads.length,redisWrites:writes.length,redisCommands:commands.length,redisHttpRequests:commands.length,billedCommandReductionVsLegacyReads:39}));
