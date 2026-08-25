import {socialVisualProfile,buildSocialSlides} from './social-visual.js';
import {INSTAGRAM_CAROUSEL_MAX_SLIDES} from './instagram-carousel-contract.js';
export const INSTAGRAM_CAROUSEL_MAX_ITEMS=INSTAGRAM_CAROUSEL_MAX_SLIDES;
export function shouldUseCarousel(article){return Array.isArray(buildSocialSlides(article))&&buildSocialSlides(article).length>1;}
export function buildCarouselImageUrls(siteUrl,articleId,slideCount){const count=Math.max(0,Math.min(INSTAGRAM_CAROUSEL_MAX_ITEMS,Number(slideCount)||0));return Array.from({length:count},(_,index)=>`${String(siteUrl||'').replace(/\/$/,'')}/api/social-card/${encodeURIComponent(String(articleId||''))}?slide=${index+1}`);}
export function visualRelevance(article){const profile=socialVisualProfile(article);return{category:String(profile?.category||'Berita'),keywords:Array.isArray(profile?.keywords)?profile.keywords:[],visualStyle:String(profile?.style?.icon||'NEWS'),accent:String(profile?.style?.accent||'#1d4ed8')};}
