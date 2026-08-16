import { readArticles } from '../lib/storage.js';
import { persistenceConfigured, acquireLock, releaseLock, getJson, setJson } from '../lib/persistence.js';
import { instagramConfigured, instagramConfig, createMediaContainer, createCarouselContainer, pollContainerReady, publishMediaContainer, getPublishingUsage, classifyInstagramError } from '../lib/instagram.js';
import { SOCIAL_LOCK_KEY, SOCIAL_LOCK_TTL, socialConfig, shouldSkipCooldown, shouldSkipDailyLimit, shouldSkipMetaBuffer, queueSocialArticle, readSocialQueue, readRecentPublished, selectBestSocialArticle, buildEligibleSocialQueue, deterministicCaption, getDailyPublishedCount, getLastPublishedAt, markSocialProcessing, markSocialFailure, markSocialPublished, incrementDailyPublishedCount } from '../lib/social.js';
import { buildSocialSlides } from '../lib/social-visual.js';
import { buildCarouselImageUrls } from '../lib/social-carousel.js';
import { validateSocialCardUrl } from '../lib/social-card-validation.js';

async function validatePublicImage(url,expectedTextLength=0) {
  return validateSocialCardUrl(url,{expectedTextLength});
}

function retryDelay(attempts) { return Math.min(30 * 60 * 1000, Math.max(60 * 1000, 2 ** Math.min(attempts, 5) * 60 * 1000)); }

export async function createCarouselChildren(urls, createChild=createMediaContainer) {
  return Promise.all(urls.map(url => createChild({ imageUrl: url, isCarouselItem: true })));
}

export async function createAndPublishMedia(article, caption, siteUrl) {
  const started = Date.now();
  const slides = buildSocialSlides(article);
  const urls = buildCarouselImageUrls(siteUrl, article.id, slides.length);
  if (!urls.length || urls.length > 2) throw new Error('social_card_invalid_slide_count');
  const validationStarted = Date.now();
  await Promise.all(urls.map((url,index) => validatePublicImage(url, buildSocialSlides(article)[index]?.summary?.length || buildSocialSlides(article)[index]?.title?.length || 0)));
  const imageValidationMs = Date.now() - validationStarted;

  if (slides.length === 1) {
    const containerStarted = Date.now();
    const containerId = await createMediaContainer({ imageUrl: urls[0], caption });
    const ready = await pollContainerReady(containerId);
    const containerMs = Date.now() - containerStarted;
    if (!ready.ready) return { ready, containerId, perf: { imageValidationMs, containerMs, publishMs: 0, totalMediaMs: Date.now() - started } };
    const publishStarted = Date.now();
    const mediaId = await publishMediaContainer(containerId);
    return { ready, containerId, mediaId, carousel: false, perf: { imageValidationMs, containerMs, publishMs: Date.now() - publishStarted, totalMediaMs: Date.now() - started } };
  }

  const containerStarted = Date.now();
  const childIds = await createCarouselChildren(urls);
  const childReadiness = await Promise.all(childIds.map(childId => pollContainerReady(childId)));
  const failedChild = childReadiness.find(result => !result.ready);
  if (failedChild) return { ready: failedChild, childIds, carousel: true, perf: { imageValidationMs, containerMs: Date.now() - containerStarted, publishMs: 0, totalMediaMs: Date.now() - started } };
  const containerId = await createCarouselContainer({ children: childIds, caption });
  const ready = await pollContainerReady(containerId);
  const containerMs = Date.now() - containerStarted;
  if (!ready.ready) return { ready, containerId, childIds, carousel: true, perf: { imageValidationMs, containerMs, publishMs: 0, totalMediaMs: Date.now() - started } };
  const publishStarted = Date.now();
  const mediaId = await publishMediaContainer(containerId);
  return { ready, containerId, childIds, mediaId, carousel: true, perf: { imageValidationMs, containerMs, publishMs: Date.now() - publishStarted, totalMediaMs: Date.now() - started } };
}

export async function runSocialCycle({ trigger = 'manual', now = Date.now() } = {}) {
  const cycleStarted = Date.now();
  if (!instagramConfig().enabled) return { status: 'skipped', reason: 'disabled', durationMs: Date.now() - cycleStarted };
  if (!instagramConfigured()) return { status: 'skipped', reason: 'missing_configuration', durationMs: Date.now() - cycleStarted };
  if (!persistenceConfigured()) return { status: 'skipped', reason: 'persistence_not_configured', durationMs: Date.now() - cycleStarted };

  const lockToken = `${trigger}:${process.pid}:${now}`;
  if (!(await acquireLock(SOCIAL_LOCK_KEY, lockToken, SOCIAL_LOCK_TTL))) {
    console.log('[social] skipped reason=lock_busy');
    return { status: 'skipped', reason: 'lock_busy', durationMs: Date.now() - cycleStarted };
  }

  try {
    const cfg = socialConfig();
    const last = await getLastPublishedAt();
    if (shouldSkipCooldown(last, now, cfg.minIntervalMinutes)) {
      console.log('[social] skipped reason=cooldown');
      return { status: 'skipped', reason: 'cooldown', durationMs: Date.now() - cycleStarted };
    }

    const daily = await getDailyPublishedCount(now);
    if (shouldSkipDailyLimit(daily, cfg.maxPostsPerDay)) {
      console.log('[social] skipped reason=daily_limit');
      return { status: 'skipped', reason: 'daily_limit', publishedToday: daily, durationMs: Date.now() - cycleStarted };
    }

    const queueStarted = Date.now();
    let queue = await readSocialQueue(100);
    let fallbackReconciled = 0;
    if (!queue.length) {
      const articles = await readArticles();
      const candidates = articles.filter(article => article?.id && article?.sitePublishedAt).slice(0, 20);
      await Promise.allSettled(candidates.map(article => queueSocialArticle(article)));
      fallbackReconciled = candidates.length;
      queue = await readSocialQueue(20);
    }
    const queueReadMs = Date.now() - queueStarted;
    const eligible = buildEligibleSocialQueue(queue);
    if (!eligible.length) {
      console.log(`[social] skipped reason=queue_empty fallbackReconciled=${fallbackReconciled}`);
      return { status: 'skipped', reason: 'queue_empty', queueReadMs, durationMs: Date.now() - cycleStarted };
    }

    const metaStarted = Date.now();
    const usage = await getPublishingUsage();
    const metaLimitMs = Date.now() - metaStarted;
    if (shouldSkipMetaBuffer(usage, cfg.limitBuffer)) {
      console.log('[social] skipped reason=meta_limit_buffer');
      return { status: 'skipped', reason: 'meta_limit_buffer', remaining: usage.remaining, queueReadMs, metaLimitMs, durationMs: Date.now() - cycleStarted };
    }

    const recent = await readRecentPublished(20);
    const selected = selectBestSocialArticle(eligible, { now, recentPublished: recent });
    if (!selected) {
      console.log('[social] skipped reason=no_worthy_content');
      return { status: 'skipped', reason: 'no_worthy_content', queueReadMs, metaLimitMs, durationMs: Date.now() - cycleStarted };
    }

    const publishedState = await getJson(`ba:social:instagram:published:${selected.articleId}`);
    if (publishedState) {
      console.log(`[social] skipped reason=already_published articleId=${selected.articleId}`);
      return { status: 'skipped', reason: 'already_published', articleId: selected.articleId, queueReadMs, metaLimitMs, durationMs: Date.now() - cycleStarted };
    }

    const processing = await markSocialProcessing(selected);
    const article = selected.article;
    console.log(`[social] selected articleId=${article.id} score=${selected.selectionScore}`);

    try {
      const caption = deterministicCaption(article, instagramConfig().siteUrl);
      const result = await createAndPublishMedia(article, caption, instagramConfig().siteUrl);
      processing.containerId = result.containerId;
      processing.carousel = Boolean(result.carousel);
      processing.childContainerIds = result.childIds || [];
      await setJson(`ba:social:instagram:item:${processing.articleId}`, { ...processing, updatedAt: new Date().toISOString() });

      if (!result.ready.ready) {
        const err = result.ready.permanent ? new Error('instagram_media_processing_failed') : new Error('instagram_media_processing_pending');
        if (result.ready.permanent) {
          await markSocialFailure(processing, err, { permanent: true });
          console.warn(`[instagram] failed articleId=${article.id} reason=media_processing_failed`);
          return { status: 'skipped', reason: 'media_processing_failed', queueReadMs, metaLimitMs, durationMs: Date.now() - cycleStarted };
        }
        await markSocialFailure(processing, err, { retryAfterMs: retryDelay(processing.attempts) });
        console.log(`[instagram] failed articleId=${article.id} reason=media_processing_pending`);
        return { status: 'retry', reason: 'media_processing_pending', queueReadMs, metaLimitMs, durationMs: Date.now() - cycleStarted };
      }

      const mediaId = result.mediaId;
      const publishedAt = new Date().toISOString();
      let record = null;
      let persistenceError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { record = await markSocialPublished(processing, { mediaId, publishedAt }); break; }
        catch (error) { persistenceError = error; if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * attempt)); }
      }
      if (!record) {
        console.error(`[social] published_state_persist_failed articleId=${article.id} reason=${String(persistenceError?.message || persistenceError).slice(0, 120)}`);
        return { status: 'persist_error', articleId: article.id, mediaId, queueReadMs, metaLimitMs, durationMs: Date.now() - cycleStarted };
      }

      let publishedToday = daily + 1;
      try { publishedToday = await incrementDailyPublishedCount(now); }
      catch (error) { console.warn(`[social] daily_counter_update_failed articleId=${article.id} reason=${String(error?.message || error).slice(0, 120)}`); }
      const perf = result.perf || {};
      console.log(`[instagram] published articleId=${article.id} mediaId=${mediaId}${result.carousel ? ' type=carousel' : ''} durationMs=${Date.now() - cycleStarted} queueReadMs=${queueReadMs} imageValidationMs=${perf.imageValidationMs||0} containerMs=${perf.containerMs||0} publishMs=${perf.publishMs||0}`);
      return { status: 'published', articleId: article.id, slug: article.slug, mediaId, publishedAt, carousel: Boolean(result.carousel), slideCount: buildSocialSlides(article).length, queueRemaining: Math.max(0, eligible.length - 1), publishedToday, record, perf: { queueReadMs, metaLimitMs, imageValidationMs: perf.imageValidationMs || 0, containerMs: perf.containerMs || 0, publishMs: perf.publishMs || 0, totalMs: Date.now() - cycleStarted } };
    } catch (error) {
      const classification = classifyInstagramError(error);
      const permanent = classification.kind === 'permanent';
      const ambiguous = classification.kind === 'ambiguous' || classification.reason === 'instagram_publish_ambiguous';
      await markSocialFailure(processing, error, { permanent, ambiguous, retryAfterMs: retryDelay(processing.attempts) });
      const safeStatus = Number(error?.status || 0);
      const safeMetaCode = Number(classification.metaCode || error?.metaCode || 0);
      console.warn(`[instagram] failed articleId=${article.id} reason=${classification.reason} status=${safeStatus} metaCode=${safeMetaCode} operation=${error?.instagramOperation||'unknown'}`);
      return { status: ambiguous || permanent ? 'failed' : 'retry', articleId: article.id, reason: classification.reason, queueReadMs, metaLimitMs, durationMs: Date.now() - cycleStarted };
    }
  } finally { await releaseLock(SOCIAL_LOCK_KEY, lockToken).catch(() => {}); }
}

if (process.argv[1]?.endsWith('/worker/social-run.js')) {
  runSocialCycle({ trigger: 'cli' }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(`[social] fatal ${String(error?.message || error).slice(0, 240)}`); process.exitCode = 1; });
}
