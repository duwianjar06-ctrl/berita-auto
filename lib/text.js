export function cleanExcerpt(value=''){
  return String(value||'')
    .replace(/(?:\s*\.{3,}\s*)+$/,'')
    .replace(/\s+\.$/,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}
