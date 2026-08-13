import {createHash} from 'node:crypto';
export function fingerprint(value=''){return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0,24);}
