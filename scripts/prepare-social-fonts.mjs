import {mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const OUT=path.join(process.cwd(),'assets','fonts');
const REF='ffebf8c1ee449e544955a7e813c54f9b73848eac';
const files=[
  ['NotoSans-Regular.ttf',`https://raw.githubusercontent.com/notofonts/noto-fonts/${REF}/hinted/ttf/NotoSans/NotoSans-Regular.ttf`],
  ['NotoSans-Bold.ttf',`https://raw.githubusercontent.com/notofonts/noto-fonts/${REF}/hinted/ttf/NotoSans/NotoSans-Bold.ttf`]
];
await mkdir(OUT,{recursive:true});
for(const [name,url] of files){
  const target=path.join(OUT,name),tmp=`${target}.tmp`;
  const response=await fetch(url,{redirect:'follow'});
  if(!response.ok)throw new Error(`social_font_download_failed:${name}:${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<10000)throw new Error(`social_font_invalid_size:${name}:${bytes.length}`);
  if(bytes.subarray(0,4).toString('latin1')!=='\x00\x01\x00\x00')throw new Error(`social_font_invalid_ttf:${name}`);
  await writeFile(tmp,bytes);await rename(tmp,target);
  console.log(`[social-card-font] prepared name=${name} source=bundled-ttf bytes=${bytes.length} sha256=${createHash('sha256').update(bytes).digest('hex')}`);
}
