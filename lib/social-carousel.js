import {socialVisualProfile,buildSocialSlides} from './social-visual.js';

export const INSTAGRAM_CAROUSEL_MAX_ITEMS=10;
export function shouldUseCarousel(article){return buildSocialSlides(article).length>1;}
export function buildCarouselImageUrls(siteUrl,articleId,slideCount){return Array.from({length:Math.min(INSTAGRAM_CAROUSEL_MAX_ITEMS,slideCount)},(_,index)=>`${String(siteUrl).replace(/\/$/,'')}/api/social-card/${encodeURIComponent(articleId)}?slide=${index+1}`);}
export function visualRelevance(article){const profile=socialVisualProfile(article);return{category:profile.category,keywords:profile.keywords,visualStyle:profile.style.icon,accent:profile.style.accent};}
