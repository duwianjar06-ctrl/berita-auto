import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const legacy='https://berita-auto.vercel.app';
const ignoredDirs=new Set(['.git','node_modules','.next']);
const allowed=(file)=>/(migration|regression|test|\.env\.example$|README|docs)/i.test(file);
const hits=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(ignoredDirs.has(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(js|jsx|mjs|ts|tsx|json|md)$/.test(entry.name)){const rel=path.relative(root,full);if(allowed(rel))continue;const text=fs.readFileSync(full,'utf8');if(text.includes(legacy))hits.push(rel)}}}
walk(root);
if(hits.length)throw new Error(`legacy runtime domain found: ${hits.join(', ')}`);
console.log('legacy runtime domain regression: PASS');
