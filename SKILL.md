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

Official RSS sources -> normalize/dedupe/classify -> pending queue (`data/pending-articles.json`) -> choose one publication -> source material fetch -> AI paraphrase -> image enrichment -> published store (`data/articles.json`) -> Next.js/Vercel.

Ingestion and publication are deliberately separate. Queue intake can add many candidates, but a worker run publishes at most one article.

## Important Configuration

Current worker constants live in `worker/strategy.js`:

- normal ingestion max: 24
- catch-up ingestion max: 48
- queue target: 60
- low watermark: 30
- queue max: 120
- max public publication per run: 1
- freshness default: 12 hours
- RSS concurrency: 8
- AI timeout: 18 seconds
- source material timeout: 5 seconds

The production scheduler targets approximately five minutes using `2-59/5 * * * *` on `main`.

## Publication Rules

- Ingestion != publication.
- Queue intake may add up to 24 candidates normally or 48 when the queue is below 30.
- Only one pending candidate is promoted to published per worker run.
- Freshness, category rotation, breaking priority, and international weighting affect publication order.
- Pending articles are never exposed by public storage readers, sitemap, category pages, or article routes because only `data/articles.json` is public content storage.
- Duplicate fingerprints are rejected across pending and published stores.

## Pending Queue

Path: `data/pending-articles.json`

Metadata fields are intentionally small: `fingerprint`, `title`, `summary`, `url`, `sourceUrl`, `sourceName`, `category`, `imageUrl`, `queuedAt`, `priority`, plus `slug` when available.

Queue expiration is normally 12 hours. Stale candidates are removed instead of publishing days-old material. Queue max is 120.

Crash safety comes from fingerprint checks and separate queue/published files. A candidate is removed from pending only after the published article is written.

## Categories

The fixed 12 categories are:

Nasional, Internasional, Ekonomi, Bisnis, Teknologi, Olahraga, Hiburan, Lifestyle, Otomotif, Sains, Politik, Daerah.

`worker/category.js` gives dedicated feeds high confidence. `ANTARA Terkini` is classified from title + summary using weighted contextual rules; the presence of a word such as `digital` does not automatically mean Teknologi.

## RSS Sources

`lib/sources.js` and `lib/sources-extra.js` contain 30 official ANTARA RSS endpoints. The source policy is official/reliable feeds only; never invent an RSS URL. International coverage is strengthened by dedicated ANTARA world/international/ASEAN feeds.

## AI Article Generation

`lib/ai.js` performs lazy generation only for the one article being published. `worker/source-material.js` attempts to fetch the source article and extract paragraph material before generation.

The prompt requires:

- Indonesian newsroom style
- genuine paraphrase, not synonym replacement
- 5-8 paragraphs when factual material supports it
- no fabricated facts, people, interviews, statistics, citations, or direct quotes
- no artificial `...`
- source attribution

Direct quotes are used only when present in source material. If the source material is unavailable, the worker falls back to the available RSS summary rather than inventing detail.

## Article Schema

Published article records keep existing compatibility fields and may add:

- `fingerprint`
- `sourcePublishedAt`
- `sitePublishedAt`
- `updatedAt`
- `createdAt`
- `imageSource`

`publishedAt` remains the source publication timestamp for backward compatibility. `sitePublishedAt` is the time Berita Auto published the article.

## Timestamp Semantics

- `publishedAt` / `sourcePublishedAt`: timestamp supplied by the source feed.
- `sitePublishedAt`: actual Berita Auto publication time.
- `updatedAt`: only when the article is genuinely updated.

Article detail UI labels these separately.

## Analytics

Real per-article views are **not yet active**. The repository has no persistent analytics datastore dependency or configured writable analytics backend that the application can safely query from `/admin-berita`.

Do not fake views and do not commit pageview counters to `data/articles.json`. The exact blocker is persistent analytics storage plus a server-side read/query interface for views and aggregate country/region/city data.

## Homepage

`app/home/page.jsx` provides the editorial homepage with header, latest ticker, hero, compact cards, category sections, carousel, advertisements, and footer. `components/StoryCarousel.jsx` implements lightweight native/CSS horizontal scrolling with prev/next controls and mobile swipe behavior.

## Article Detail

`app/berita/[slug]/page.jsx` renders the full `article.content` without slicing, substring, line-clamp, max-height cutoff, or overflow clipping. Article metadata separates source publication time from site publication time, includes NewsArticle JSON-LD, related articles, source attribution, sharing, sidebar, and in-article advertising.

## Advertising

Reusable component: `components/AdSlot.jsx`.

Current placements: top leaderboard, in-feed, article, sidebar rectangle, footer/secondary.

Advertising CTA uses WhatsApp `08515793801` with the approved `wa.me/628515793801?...` URL. Ads are placeholders, not fake inventory.

## Admin

Route: `/admin-berita`.

Auth: Google OAuth through `auth.js`, restricted by `ADMIN_EMAILS`. Personal Notes remain in `components/admin/AdminNotes.jsx`.

Analytics views are not displayed as fake numbers. Once persistent analytics infrastructure is configured, admin analytics should be added without changing auth or notes behavior.

## SEO

Canonical URLs come from `lib/article-url.js`.

Article metadata includes title, description, canonical, OpenGraph, Twitter, and NewsArticle JSON-LD. Automated authorship is represented honestly as Berita Auto rather than a fabricated reporter.

`app/robots.js` and existing Google verification behavior must not be removed.

## Sitemap

`app/sitemap.js` includes:

- homepage
- all 12 category pages
- published canonical article URLs

Pending, admin, auth, API, and other private URLs are excluded.

Homepage and category `lastModified` values derive from latest published content, not `new Date()` on every request. Article lastmod prefers `updatedAt`, then `sitePublishedAt`, then source publication time.

## Important File Map

- `lib/rss.js` — RSS parsing/fetching
- `lib/sources.js` — core official sources
- `lib/sources-extra.js` — additional official sources
- `lib/ai.js` — article paraphrase/generation
- `worker/source-material.js` — source article material extraction
- `worker/category.js` — deterministic category classifier
- `worker/normalize.js` — URL normalization/fingerprinting
- `worker/strategy.js` — queue intake, freshness, rotation, publication selection
- `worker/run.js` — single-run orchestration
- `lib/storage.js` — published + pending JSON persistence
- `data/articles.json` — published articles
- `data/pending-articles.json` — pending candidates
- `app/home/page.jsx` — homepage
- `components/StoryCarousel.jsx` — carousel
- `app/berita/[slug]/page.jsx` — article detail
- `app/kategori/[slug]/page.jsx` — category pages
- `app/admin-berita/page.jsx` — admin console
- `app/sitemap.js` — semantic sitemap
- `vercel.json` — admin headers and data-only deployment ignore behavior
- `.github/workflows/feature-branch-scheduler.yml` on `main` — production scheduler
- `.github/workflows/auto-news.yml` on application branch — manual worker workflow

## Scheduler

Scheduler path on `main`: `.github/workflows/feature-branch-scheduler.yml`.

Trigger: `2-59/5 * * * *` plus manual dispatch.

The workflow checks out `feature/auto-news-mvp`, uses Node 22, npm cache, `npm ci --prefer-offline --no-audit`, runs `npm run news:run`, commits queue + article data, rebases on the latest application branch, and pushes without force.

Concurrency group: `auto-news`, `cancel-in-progress: false`.

Self-dispatch chain is not used. Cron remains the simple recovery mechanism. If historical runs prove persistent misses, add recovery only after measuring the real gaps.

## Git Commit Procedure

1. Fetch latest target branch HEAD.
2. Fetch current target files.
3. Inspect the current architecture and relevant diff.
4. Get the current base tree.
5. Create blobs with Git Data API.
6. Create a tree on the latest base tree.
7. Re-fetch HEAD immediately before commit/ref update.
8. If HEAD changed, rebuild the tree and commit on the latest HEAD.
9. Create the commit.
10. Update the branch ref with `force=false` only.
11. Fetch committed files/commit and verify.
12. If the worker generated data concurrently, never overwrite it.

## Commit Convention

Use `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`.

## Deployment Procedure

Application code belongs on `feature/auto-news-mvp`. After commit, verify the automatic Vercel Production deployment.

Production verification must confirm:

- project: `berita-auto`
- environment: Production
- branch: `feature/auto-news-mvp`
- intended SHA or descendant
- status: READY
- domain: `berita-auto.vercel.app`

If automatic deployment does not occur and the available tools cannot safely create one, use Vercel Create Deployment with the exact latest application SHA; never deploy an older commit.

## Vercel Configuration

`vercel.json` keeps admin no-store/noindex headers and ignores commits that modify only `data/articles.json` and/or `data/pending-articles.json` for Vercel build purposes. This is designed to avoid UI rebuilds on worker-only data commits. Behavior must be re-verified whenever Vercel changes.

## Environment Variables

Names only:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ADMIN_EMAILS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`

Never document actual secret values.

## Secret Policy

Never commit `.env`, API keys, OAuth secrets, passwords, GitHub tokens, or analytics credentials.

## Build Procedure

Required commands when runtime is available:

`npm ci`

`npm run build`

`npm run news:run`

## DO NOT BREAK

Preserve Google OAuth, `ADMIN_EMAILS`, Personal Notes, article IDs/fingerprints/slugs, canonical URLs, old redirects, RSS dedupe, pending/published dedupe, one-at-a-time publishing, sitemap, robots, Google verification, advertising CTA, and production branch strategy.

## Before Any AI Change

1. Read `SKILL.md` completely.
2. Read `AGENTS.md` if present.
3. Fetch the latest repository.
4. Confirm the branch.
5. Fetch the current target files.
6. Understand the existing architecture.
7. Preserve existing behavior.
8. Implement the smallest safe change.
9. Build/test.
10. Commit non-force.
11. Re-fetch source after commit.
12. Verify production when deployment is requested.
13. Update `SKILL.md` when architecture changes.

## Source of Truth

The current repository wins over old conversation context.

## Documentation Maintenance

Update this file whenever architecture, worker, queue, publisher, scheduler, auth, analytics, SEO, storage, deployment, or branch strategy changes.

## Current Implementation Status

✅ queue-first ingestion/publisher implemented
✅ one publication per worker run implemented
✅ 24/48 ingestion targets implemented
✅ 30 official RSS sources configured
✅ international RSS coverage strengthened
✅ deterministic contextual classifier improved
✅ source-material fetch + lazy AI generation implemented
✅ full article rendering/no body truncation implemented
✅ compact homepage + carousel implemented
✅ semantic sitemap implemented
✅ Vercel data-only ignore optimization implemented
⚠️ real reader views/popular analytics/admin analytics not active because persistent analytics storage is not configured
⚠️ real five-minute historical cadence remains a runtime-history verification item; cron target is configured

## Last Verified

Application HEAD at documentation authoring: `3c20ef76575508413fe63f9c64d4dbe49768e31d` before this documentation/queue implementation batch.

Do not write a new Production SHA here until Vercel reports READY for the intended application commit.
