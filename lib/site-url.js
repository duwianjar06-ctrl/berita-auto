export const DEFAULT_SITE_URL='https://berita-auto-olive.vercel.app';
export function siteUrl(){return String(process.env.SITE_URL||DEFAULT_SITE_URL).replace(/\/$/,'')}
