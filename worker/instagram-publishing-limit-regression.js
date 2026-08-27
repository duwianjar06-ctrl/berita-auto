import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePublishingUsage} from '../lib/instagram.js';

const source=readFileSync(new URL('../lib/instagram.js',import.meta.url),'utf8');
assert.match(source,/content_publishing_limit\?fields=config,quota_usage/,'quota request must only request config and quota_usage');
assert.doesNotMatch(source,/content_publishing_limit\?fields=config,quota_usage,quota_duration/,'quota_duration must not be requested as a top-level field');
assert.match(source,/entry\?\.config\?\.quota_duration/,'quota duration must come from config.quota_duration');

const valid=parsePublishingUsage({data:[{quota_usage:17,config:{quota_total:100,quota_duration:86400}}]});
assert.deepEqual(valid,{available:true,usage:17,total:100,remaining:83,durationSeconds:86400});
assert.equal(valid.remaining>0,true);

const exhausted=parsePublishingUsage({data:[{quota_usage:100,config:{quota_total:100,quota_duration:86400}}]});
assert.deepEqual(exhausted,{available:true,usage:100,total:100,remaining:0,durationSeconds:86400});
assert.equal(exhausted.remaining>0,false);

const invalid=parsePublishingUsage({data:[{quota_usage:'bad',config:{quota_total:100,quota_duration:86400}}]});
assert.equal(invalid.available,false);
assert.equal(invalid.remaining,null);

assert.match(source,/metaCode/);
assert.match(source,/metaSubcode/);
assert.match(source,/metaType/);
assert.match(source,/httpStatus/);
assert.match(source,/instagramOperation/);
assert.doesNotMatch(source,/console\.(log|warn).*accessToken/);
assert.doesNotMatch(source,/console\.(log|warn).*Bearer\s*\$\{/);

console.log('instagram-publishing-limit-regression: PASS');
