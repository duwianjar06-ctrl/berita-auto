# Berita Auto

## Project Identity

Repository: `projectdaaw-bot/berita-auto`
Production URL: `https://berita-auto.vercel.app`
Admin URL: `https://berita-auto.vercel.app/admin-berita`
Stack: Next.js 15.5.7, React 19.1, NextAuth v5 beta, Node.js 22 for worker Actions.

## Branch Strategy

- Application: `feature/auto-news-mvp`
- Scheduler/default infrastructure: `main`
- Production branch: `feature/auto-news-mvp`
- Never force-push or force-update refs.

## Architecture

Official RSS -> normalize/dedupe/classify -> pending queue (`data/pending-articles.json`) -> select one -> source material -> AI paraphrase when configured -> image enrichment -> published store (`data/articles.json`) -> Next.js/Vercel.

Ingestion and publication are separate. Intake may add 24 or 48 candidates, but a worker run publishes at most one article.

## Important Configuration

Worker constants are in `worker/strategy.js`:

- normal ingestion max: 24
- catch-up ingestion max: 48
- queue target: 60
- low watermark: 30
- queue max: 120
- max publication per run: 1
- freshness cutoff: 12 hours
- RSS concurrency: 8
- AI timeout: 18s
- source material timeout: 5s

Production cron target on `main`: `2-59/5 * * * *`.

## Queue and Publication

`data/pending-articles.json` stores candidate metadata only. Pending is not part of public article reads, category pages, homepage, analytics, or sitemap.

When pending <30, intake targets 48 new candidates. When pending is 30-59, intake targets 24. When pending >=60, normal refill is skipped unless breaking/fresh logic is added safely. Queue never exceeds 120. Candidates older than 12h are normally expired.

Publication scoring considers freshness, breaking priority, category rotation, international priority, and queue age. Fingerprints are unique across both pending and published stores.

`worker/run.js` writes published and pending files together. A candidate is removed from pending only after the published article is written.

## Sources

`lib/sources.js` + `lib/sources-extra.js` currently define 30 official ANTARA RSS sources, including dedicated international, ASEAN, sports, economy, business, lifestyle, entertainment, technology, automotive, science/environment, and regional feeds.

Policy: official/reliable RSS only. Never invent or guess RSS URLs.

## Categories

Nasional, Internasional, Ekonomi, Bisnis, Teknologi, Olahraga, Hiburan, Lifestyle, Otomotif, Sains, Politik, Daerah.

`worker/category.js` uses dedicated-feed confidence plus contextual keyword scoring. `ANTARA Terkini` is not automatically Nasional. Context overrides isolated words such as `digital` when the broader story is politics/business/economy.

## Article Generation

`worker/source-material.js` fetches source article text when available. `lib/ai.js` performs lazy generation only for the candidate currently being published.

The prompt requires genuine paraphrase, changed sentence/paragraph structure, no fabricated quote/person/fact/interview/statistic, no false field reporting, and no artificial ellipsis. Source attribution remains present.

### AI Credential Status

The available GitHub Actions test environment currently exposes an empty `OPENAI_API_KEY`. Therefore the queue/publisher/runtime tests prove ingestion, selection, source-material fallback, image enrichment, and persistence mechanics, but they do **not** prove a live OpenAI paraphrase call.

Do not add fake credentials. GitHub Actions must use `secrets.OPENAI_API_KEY` when configured.

## Existing Article Repair

`worker/repair.js` detects existing published articles with suspicious truncation (`...`) or very short bodies. It repairs **one article per invocation** and refuses to replace content with raw source text when `OPENAI_API_KEY` is missing. This prevents a maintenance run from silently converting source material into copy-paste content.

Command: `npm run news:repair`.

Historical articles that still contain source-summary ellipses remain a maintenance issue until a real AI credential is available; they are not fabricated or silently copied.

## Article Detail

`app/berita/[slug]/page.jsx` renders all `article.content` paragraphs. The article body has no `slice`, `substring`, line-clamp, max-height cutoff, or overflow hiding. It separates source publication time from Berita Auto publication time and adds related articles, sharing, source attribution, article ads, sidebar, optional real popular ranking, and NewsArticle JSON-LD.

`lib/text.js` removes terminal ellipsis artifacts from summaries/excerpts without inventing missing body text.

`components/ArticleViewTracker.jsx` sends one asynchronous view event per article/session to `/api/analytics/view` when the analytics backend is configured.

## Homepage

`app/home/page.jsx` contains a dense newsroom layout: breaking/latest bar, top ad, hero, side cards, carousel, compact horizontal cards, optional real popular section, category sections, additional categories, and footer advertising.

`components/StoryCarousel.jsx` uses lightweight native horizontal scrolling, responsive card widths, keyboard focus, prev/next controls, and mobile swipe. No heavy carousel library is used.

## Ads

Reusable `components/AdSlot.jsx` with leaderboard, rectangle, in-article, sidebar, and footer placements. WhatsApp CTA: `08515793801`, URL uses the approved `wa.me/628515793801?...` target. Ads are labeled as advertising and do not enter sitemap/content.

## Analytics

Real analytics plumbing is implemented but intentionally optional.

Public event route: `app/api/analytics/view/route.js`.

Adapter: `lib/analytics.js`.

Tracker: `components/ArticleViewTracker.jsx`.

Admin endpoint: `app/api/admin/analytics/route.js`.

Persistence backend: Upstash Redis REST, activated only when both variables below exist:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The adapter uses durable Redis sorted sets and aggregates. It does not store raw full IP addresses. It uses Vercel's geolocation headers for country, region, and city. Vercel documents these headers as `x-vercel-ip-country`, `x-vercel-ip-country-region`, and `x-vercel-ip-city`. citeturn550525search0turn550525search1

Bot filtering ignores common crawler/bot/headless/monitor user agents. A per-article five-minute cookie cooldown plus sessionStorage reduces duplicate view events.

Popular windows support today/7-day/30-day aggregation using daily Redis sorted sets. Admin filtering supports date window, category, source, country, region, city, minimum/maximum views, and sort.

When Redis variables are absent, tracking no-ops and admin explicitly shows the analytics blocker. No fake view numbers are rendered and no pageview is committed to Git.

Required production unblocker: create/configure a persistent Redis store and set the two environment variables. Upstash's serverless Redis supports durable REST access and pipelines suitable for Vercel functions. citeturn903108search1turn903108search4

## Admin

Route: `/admin-berita`. Auth remains Google OAuth via `auth.js`, restricted by `ADMIN_EMAILS`. Personal Notes remains `components/admin/AdminNotes.jsx`.

When Redis analytics is configured, admin shows total views, today, 7-day/30-day views, top articles, top categories, countries, regions/cities, and filterable article rows with views. When it is not configured, the panel clearly shows the exact env names needed and does not display dummy counts.

## SEO and Sitemap

Canonical URL helper: `lib/article-url.js`.

Article metadata: title, description, canonical, OpenGraph, Twitter, NewsArticle JSON-LD, datePublished/dateModified, publisher/author as Berita Auto, mainEntityOfPage.

`app/sitemap.js` includes homepage, all 12 categories, and published canonical articles only. lastmod uses actual latest article/update times instead of `new Date()` on every request. Pending/admin/auth/API/private URLs are excluded.

Preserve robots, Google verification, old redirects, and canonical behavior.

## Persistence and Vercel

`lib/storage.js` reads published/pending JSON from the feature branch raw GitHub content on Vercel, falling back locally. Worker writes remain file-based because the existing application architecture uses Git as its persistent data channel.

`vercel.json` keeps admin no-store/noindex headers and ignores commits that change only `data/articles.json` and/or `data/pending-articles.json` so worker data commits do not require a UI rebuild. This behavior has been empirically observed: a data-only worker commit produced a canceled/non-active Vercel deployment, while code commits produced READY Production deployments.

## Scheduler

`main/.github/workflows/feature-branch-scheduler.yml` is the production scheduler. It checks out `feature/auto-news-mvp`, uses Node 22 + npm cache, runs `npm install --package-lock-only --ignore-scripts --no-audit` only to reconcile an out-of-sync lockfile, then performs the required clean `npm ci --prefer-offline --no-audit`, runs `npm run news:run`, stages `package-lock.json`, `data/articles.json`, and `data/pending-articles.json`, rebases onto the latest application branch, and pushes without force.

The lockfile reconciliation exists because the repository previously had a stale lockfile that made `npm ci` fail with EUSAGE. Once the lock is synced, later runs should make the reconciliation a no-op.

Concurrency: `auto-news`, `cancel-in-progress: false`.

Default target is one article approximately every five minutes. No self-dispatch chain is used. The latest observed scheduled run after the first scheduler commit failed at the stale lockfile before the worker stage; the corrected scheduler commit is `850c53d23dc2d9b0a2dc63d7175df77badd18f31`. A fresh scheduled run on this corrected workflow is required to mark cadence/queue persistence empirically verified.

## Git Data API Procedure

1. Fetch latest target HEAD.
2. Fetch target files/current tree.
3. Create blobs.
4. Create tree on current base.
5. Re-fetch HEAD immediately before commit/ref update.
6. If HEAD changed, rebuild tree/commit on newest HEAD.
7. Create commit.
8. `update_ref` with `force=false` only.
9. Fetch committed files/commit and verify.
10. Never overwrite worker-generated data commits.

## Commit Convention

`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`.

## Deployment Procedure

Production project: `berita-auto`.
Production branch: `feature/auto-news-mvp`.

After application code commit, verify Vercel deployment environment=Production, target=production, branch=feature/auto-news-mvp, intended SHA/descendant, state READY, alias `berita-auto.vercel.app`.

If automatic deployment is not triggered and tool support allows safe creation, deploy exact latest application SHA. Never deploy an older SHA as a workaround.

## Environment Variables

Names only; never document values:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ADMIN_EMAILS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Build and Test

Runtime commands:

`npm ci`

`npm run build`

`npm run news:run`

`npm run news:repair`

Do not claim build success unless a real build log exists.

## DO NOT BREAK

Google OAuth, `ADMIN_EMAILS`, Personal Notes, article IDs/fingerprints/slugs, canonical URLs, old redirects, RSS dedupe, queue dedupe, one-at-a-time publisher, sitemap, robots, Google verification, advertising CTA, production branch, and non-force Git history.

## Before Any AI Change

Read this file completely, read `/AGENTS.md`, fetch latest repository, confirm branch, inspect current files, preserve behavior, implement minimally, run tests/build, commit with Git Data API non-force, re-fetch source after commit, verify Production if requested, and update this file when architecture changes.

## Source of Truth

The current repository wins over old conversation context.

## Current Implementation Status

✅ queue-first 24/48 ingestion
✅ target queue 60 / low watermark 30 / max 120
✅ one publication per worker run
✅ 30 official RSS sources
✅ stronger international coverage
✅ contextual 12-category classifier
✅ full article detail body rendering
✅ dense homepage
✅ carousel
✅ semantic sitemap
✅ ads retained
✅ non-force Git procedure documented
✅ SKILL.md and AGENTS.md
✅ Vercel data-only rebuild suppression observed
✅ optional real analytics adapter/tracker/admin API implemented without fake values
⚠️ live OpenAI paraphrase not empirically verified because `OPENAI_API_KEY` is empty in available Actions environment
⚠️ historical truncated articles are not fully regenerated for the same credential reason
⚠️ real analytics will remain inactive until Upstash Redis env values are configured
⚠️ the first scheduled run after the queue scheduler change failed on stale package-lock; corrected scheduler is now `850c53d23dc2d9b0a2dc63d7175df77badd18f31` and requires a fresh successful schedule run before claiming queue persistence/cadence live

## Last Verified

Latest known READY Production deployment before the analytics code commit: SHA `976d62a210f3fb0f34062033caf7861cead28564`.

Do not write a newer Production SHA here until Vercel reports READY for the intended latest code commit.
