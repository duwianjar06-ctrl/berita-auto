# Berita Auto

## Project Identity
Repository: `projectdaaw-bot/berita-auto`
Production: `https://berita-auto.vercel.app`
Admin: `https://berita-auto.vercel.app/admin-berita`
Stack: Next.js 15.5.7, React 19.1, NextAuth v5 beta, Node 22 for Actions.

## Branch Strategy
Application: `feature/auto-news-mvp`
Scheduler/default: `main`
Production branch: `feature/auto-news-mvp`
Never force-push or force-update refs.

## Architecture
Official RSS -> normalize/dedupe/classify -> pending queue (`data/pending-articles.json`) -> select one -> source material -> AI paraphrase when configured -> image enrichment -> published store (`data/articles.json`) -> Next.js/Vercel.

Ingestion and publication are separate. Intake may add 24 or 48 candidates; a worker run publishes at most one article.

## Important Configuration
Defined in `worker/strategy.js`:
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

Production cron: `2-59/5 * * * *`.

## Queue and Publication
`data/pending-articles.json` stores candidate metadata only. Pending is not public and is excluded from homepage, categories, article reads, analytics ranking, and sitemap.

When pending <30, intake targets 48 new candidates. At 30-59, intake targets 24. At >=60, normal refill is skipped unless breaking/fresh logic is safely added. Queue max is 120. Candidates older than 12h are normally expired.

Selection considers freshness, breaking priority, category rotation, international priority, and queue age. Fingerprints are unique across pending and published data.

`worker/run.js` writes published and pending files together; a candidate is removed from pending only after successful publication.

## Sources
`lib/sources.js` + `lib/sources-extra.js` define 30 official/reliable ANTARA RSS sources spanning international, ASEAN, sports, economy, business, lifestyle, entertainment, technology, automotive, science/environment, and regional coverage.
Never invent or guess RSS URLs.

## Categories
Nasional, Politik, Ekonomi, Bisnis, Internasional, Teknologi, Olahraga, Hiburan, Lifestyle, Otomotif, Sains, Daerah.

`worker/category.js` uses dedicated-feed confidence plus contextual keyword scoring. `ANTARA Terkini` is not automatically Nasional.

## Article Generation
`worker/source-material.js` fetches factual source material. `lib/ai.js` performs lazy generation for the single candidate being published.

The AI prompt requires genuine paraphrase, changed sentence/paragraph structure, no fabricated quote/person/fact/interview/statistic, no false field reporting, and no artificial ellipsis. Source attribution remains present.

### AI Credential Status
The available Actions environment did not prove a live OpenAI paraphrase call. `OPENAI_API_KEY` must be supplied as a GitHub Actions secret; never create or commit a key.

## Existing Article Repair
`worker/repair.js` detects suspiciously short or ellipsis-truncated published articles and repairs one article per invocation when a real OpenAI key is available.
Command: `npm run news:repair`.
Without the credential it refuses to silently replace content with copied source text. Historical truncated articles therefore remain an external-credential maintenance blocker.

## Article Detail
`app/berita/[slug]/page.jsx` renders every body paragraph. There is no slice/substring/line-clamp/max-height/overflow cutoff in the article body. Source time and site publication time are separate. Related articles, share links, source attribution, ads, sidebar, optional popular ranking, and NewsArticle JSON-LD are supported.

## Homepage
Dense newsroom layout: latest/breaking bar, featured story, compact cards, horizontal cards, carousel, optional popular section, categories, ads, footer.
`components/StoryCarousel.jsx` uses lightweight native scrolling with responsive cards, swipe, controls, keyboard focus, and reduced-motion behavior.

## Ads
Reusable `components/AdSlot.jsx` supports top/in-feed/article/sidebar/footer placements. WhatsApp CTA: `08515793801` using the approved `wa.me/628515793801?...` URL.

## Analytics
Analytics plumbing is implemented but optional.
Public event route: `app/api/analytics/view/route.js`.
Adapter: `lib/analytics.js`.
Tracker: `components/ArticleViewTracker.jsx`.
Admin endpoint: `app/api/admin/analytics/route.js`.

Persistence backend: Upstash Redis REST, activated only when both exist:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The adapter uses durable Redis structures, aggregate country/region/city data from Vercel geo headers, bot filtering, and five-minute per-article cooldown. Popular windows and admin filters are supported. No raw full IP is persistently stored. When env vars are absent, analytics no-ops and no fake values are rendered.

## Admin
`/admin-berita` remains protected by existing Google OAuth and `ADMIN_EMAILS`. Personal Notes remains `components/admin/AdminNotes.jsx`. Analytics controls are shown only when the real persistence backend is configured.

### Admin Distribution Dashboard
The `DISTRIBUSI` area keeps the existing `Distribusi Kategori` section first and adds `Distribusi Sumber Berita` directly below it.

Source distribution is derived from the published article array returned by `readArticles()`, using actual `article.sourceName`. Pending candidates are never included. Articles missing `sourceName` are grouped as `Sumber tidak diketahui` so the distribution still reconciles to the published article total without inventing metadata.

Implementation helper: `lib/admin-source-distribution.js`.
It performs one pass over the published articles and returns source count, contribution percentage, latest publication timestamp, and dominant category. Default order is descending article count, then latest publication, then source name.

The dashboard shows Total Sumber, Total Berita, Sumber Terbesar, Dominasi, per-source count/percentage/progress bar, a >50% dominance warning, inline `Lihat Semua Sumber` detail table, and `Distribusi 50 Berita Terbaru` as a secondary diversity check. Source rows are links using the existing admin URL/query-state pattern (`source=...`) and preserve category/query state. The existing article pagination/filter list now applies `source` together with category and search filters.

Source distribution is distinct from Source Monitor semantics: distribution measures published articles by `sourceName`; Source Monitor measures RSS/source health and fetching state. No source counts are hardcoded, mocked, randomised, or derived from analytics views.

## SEO and Sitemap
Article metadata includes title, description, canonical, OpenGraph, Twitter, NewsArticle JSON-LD, datePublished/dateModified, publisher/author as Berita Auto, and mainEntityOfPage.
`app/sitemap.js` includes homepage, all 12 categories, and published canonical articles only. lastmod is semantic, based on actual content timestamps. Pending/admin/auth/API/private routes are excluded.

## Persistence and Vercel
`lib/storage.js` reads published/pending JSON from the feature branch raw GitHub content on Vercel. Git remains the existing persistent data channel for worker publication.
`vercel.json` suppresses rebuilds for data-only changes to `data/articles.json` and `data/pending-articles.json`; code commits still deploy normally.

## Scheduler
Canonical workflow: `main/.github/workflows/feature-branch-scheduler.yml`.

Final scheduler behavior:
- cron: `2-59/5 * * * *`
- `workflow_dispatch` retained
- checkout `feature/auto-news-mvp`
- Node 22 + npm cache
- `npm ci --prefer-offline --no-audit` only; no per-run lock regeneration
- `npm run news:run`
- stage only `data/articles.json` and `data/pending-articles.json`
- no empty commit
- fetch/rebase latest feature branch
- push non-force
- concurrency group `auto-news`, `cancel-in-progress: false`

The repository lockfile was permanently synchronized during scheduler bootstrap. Successful Actions run #19 proved `npm ci`, worker execution, queue+published data commit, rebase, and push. The lockfile is now committed on the application branch; later scheduler runs do not reconcile it.

## Scheduler Verification
Successful bootstrap run:
- workflow run: `31773483286` (run #19)
- result: all steps success
- one article published
- published site timestamp: `2026-08-14T05:35:45.119Z`
- queue data persisted in `data/pending-articles.json`

Only one publication run has been empirically observed after the final lock fix. A 3-run/5-minute cadence series has not been observed yet; do not invent gaps.

## Git Data API Procedure
1. Fetch latest target HEAD.
2. Fetch current files/tree.
3. Create blobs.
4. Create tree on current base.
5. Re-fetch HEAD immediately before commit/ref update.
6. If HEAD changed, rebuild tree/commit on newest HEAD.
7. Create commit.
8. `update_ref` with `force=false` only.
9. Re-fetch committed files/commit and verify.
10. Never overwrite worker-generated data commits.

## Commit Convention
`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`.

## Deployment Procedure
Production project: `berita-auto`.
Production branch: `feature/auto-news-mvp`.
After code commits, verify Production target, branch, intended SHA/descendant, READY state, and alias `berita-auto.vercel.app`.
Data-only worker commits are intentionally not UI deployments.

## Environment Variables
Names only, never values:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ADMIN_EMAILS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Build and Test
`npm ci`
`npm run build`
`npm run news:run`
`npm run news:repair`
Never claim build success without actual logs. The analytics import fix was deployed in Production build SHA `d058eec4574a02e4404e31474231b48f0722c931` and that deployment reached READY.

## DO NOT BREAK
Google OAuth, `ADMIN_EMAILS`, Personal Notes, article IDs/fingerprints/slugs, canonical URLs, redirects, RSS dedupe, queue dedupe, one-at-a-time publisher, sitemap, robots, Google verification, advertising CTA, production branch, and non-force Git history.

## Before Any AI Change
Read this file and `/AGENTS.md`; fetch latest repository; confirm branch; inspect current architecture; implement minimally; run test/build; commit with Git Data API non-force; re-fetch source after commit; verify Production when requested; update this file when architecture changes.

## Source of Truth
Current repository wins over old conversation context.

## Current Implementation Status
✅ queue-first 24/48 ingestion
✅ queue target 60 / low watermark 30 / max 120
✅ one publication per worker run
✅ 30 official RSS sources
✅ international coverage
✅ contextual 12-category classifier
✅ article detail/full body renderer
✅ dense homepage + carousel
✅ semantic sitemap
✅ ads retained
✅ analytics import routes build correctly
✅ package-lock permanently synced
✅ `npm ci` proven successful in scheduler run #19
✅ queue + published data persisted by scheduler run #19
✅ final scheduler contains cron + workflow_dispatch and no per-run lock regeneration
✅ non-force Git Data procedure documented
✅ Vercel Production READY for application code commit `d058eec4574a02e4404e31474231b48f0722c931`
✅ admin source distribution code added from real published `sourceName` data
✅ admin source filter integrated with existing query-state and category filter
⚠️ live OpenAI paraphrase/repair not verified because credential availability is not exposed by the available connector and prior worker execution used factual fallback
⚠️ real views/geo/popular remain inactive until Upstash Redis environment variables are configured
⚠️ three successive five-minute publication gaps have not been empirically verified
⚠️ final Vercel deployment for the new admin distribution feature must reach READY before visual production verification can be claimed

## Last Verified
Application feature branch HEAD before the documentation commit: `ed3ecf326dfd374b1370d7c6e13c80201c9a359f`.
Scheduler HEAD: `4426070443c35f46a57ea372f997c2a0d4cf0398`.
Latest READY Production code deployment before this feature: `d058eec4574a02e4404e31474231b48f0722c931`.
The source-distribution feature is a code change and therefore requires a fresh Production deployment.
