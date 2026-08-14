# Berita Auto

## Project Identity
Repository: `projectdaaw-bot/berita-auto`
Production: `https://berita-auto.vercel.app`
Admin: `https://berita-auto.vercel.app/admin-berita`
Stack: Next.js 15.5.7, React 19.1, NextAuth v5 beta, Node 22 in GitHub Actions.

## Branch Strategy
Application: `feature/auto-news-mvp`
Scheduler/default: `main`
Production branch: `feature/auto-news-mvp` (verified current Vercel project configuration; do not change to `main`)
Never force-push or force-update refs.

## Core Architecture
Official RSS -> normalize/dedupe/classify -> pending queue -> select one/more according to adaptive catch-up -> source material -> provider registry (Gemini -> optional OpenAI) -> factual fallback -> image enrichment -> persistent publication storage.

### Runtime Publication Architecture
When Upstash Redis is configured, it is the live source of truth for published articles and the pending queue. GitHub JSON files are migration/backup snapshots, not the live production datastore.

Production publication service is exposed through `/api/cron/news-publish` and delegates to the shared `runPublicationCycle({trigger, now})` implementation in `worker/run.js`. The endpoint never performs Git operations. It authenticates with `CRON_SECRET`, acquires the shared Redis publication lock, runs the normal queue/AI/image pipeline, writes the result to persistence, records telemetry, and releases the lock.

Current trigger roles:
- Primary target: Vercel Cron at approximately every five minutes, only after the project plan is verified to support the required interval.
- Fallback: GitHub Actions workflow on `main`, which calls the same secured publication endpoint and does not write Git data itself.
- Manual: the same shared publication cycle may be called by controlled recovery tooling.

Do not implement a second publication business-logic path. All triggers must call the same publication service.

### Persistence and Migration
Persistence adapter: `lib/persistence.js` using the existing Upstash Redis REST configuration.

Keys currently used by live publication:
- `ba:news:articles`
- `ba:news:pending`
- `ba:news:publication-lock`
- existing pipeline keys under `ba:pipeline:*`

On first access when a key is absent, the storage layer performs an idempotent migration from the existing `data/articles.json` or `data/pending-articles.json` snapshot. Existing IDs/fingerprints are preserved. Later production reads/writes use Redis only when persistence is configured.

Production must fail closed rather than silently falling back to stale bundled or GitHub data when persistent storage is unavailable.

### Publication Lock
`lib/persistence.js` provides an atomic Redis `SET ... NX EX` lock used by `runPublicationCycle` so Vercel Cron, GitHub fallback, and other recovery triggers cannot execute as concurrent writers. Lock TTL is intentionally slightly longer than the target worker runtime and must never be replaced by an in-memory/global JavaScript lock.

### Adaptive Publication Policy
`worker/strategy.js` currently uses:
- normal: 1 publication
- delayed: 2 publications
- stale: 3 publications
- long outage: 5 publications
- hard maximum: 5

The queue remains bounded at low watermark 30, target 60, max 120, with a 12-hour freshness cutoff. Catch-up is recovery only; normal cadence remains approximately one publication per five minutes.

`data/articles.json` and `data/pending-articles.json` are still maintained for backup/migration and Git-based fallback compatibility. The live worker must not require a Git commit/push to make a production publication visible when Redis is configured.

## Queue and Publication
Configuration remains in `worker/strategy.js`:
- normal ingestion max 24
- catch-up ingestion max 48
- queue target 60
- low watermark 30
- queue max 120
- adaptive max publications: 1/2/3/5
- hard publication max 5
- freshness cutoff 12 hours
- RSS concurrency 8
- AI timeout 18s baseline
- source material timeout 5s

Pending candidates are never public. Publication timestamps use actual `sitePublishedAt` time; never synthesize five-minute timestamps for articles published together.

## Shared Admin Notes
`components/admin/AdminNotes.jsx` is now a thin client wrapper around `AdminWorkspace` and does not use localStorage as the source of truth.

Persistent backend: existing Upstash Redis REST configuration, reused from the project analytics persistence pattern.
Environment:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Note model supports:
`id`, `title`, `content`, `createdBy`, `createdByEmail`, `updatedBy`, `updatedByEmail`, `isPinned`, `createdAt`, `updatedAt`, optional `deletedAt`.

All notes APIs are server-side protected with `auth()` plus `ADMIN_EMAILS`. CRUD and pin/unpin use API routes under `/api/admin/notes`. All authorized admins read the same records.

Legacy localStorage notes are eligible for a one-time import after login. The migration flag may live in localStorage, but the note data source of truth remains the database. Duplicate legacy notes are skipped using title/content signatures.

If Upstash credentials are absent, notes APIs fail closed with HTTP 503 rather than silently falling back to localStorage.

## Project Work Log
The Admin Workspace has `Catatan`, `Pekerjaan & Perbaikan`, and `Automation / News Pipeline` tabs.

Work Log model supports:
- title, description, type, status, priority
- createdBy, updatedBy, assignedTo
- problem, fixDescription, verificationResult, blocker
- commitSha, deploymentId
- createdAt, updatedAt, resolvedAt

Types: Feature, Bug, Improvement, SEO, Scheduler, AI, UI, Deployment, Infrastructure, Security, Other.

Statuses: Belum Dikerjakan, Sedang Dikerjakan, Sudah Diperbaiki, Sudah Disesuaikan, Perlu Verifikasi, Blocked, Gagal, Selesai.

Priority: Low, Normal, High, Critical.

Status semantics: code written is not completion; build success is still verification work; a production-ready deployment without route verification remains `Perlu Verifikasi`; `Blocked` is reserved for real external dependencies; `Selesai` requires production evidence.

Known real issues are represented as stable baseline IDs and are not duplicated on every admin visit.

## AI Provider Architecture
`lib/ai-providers.js` defines the normalized provider registry and interface: `name`, `modelName`, `isConfigured`, `generate`, `timeoutMs`.

Active order:
1. Gemini primary when `GEMINI_API_KEY` exists.
2. OpenAI optional secondary when configured.
3. factual non-AI fallback.

Provider errors normalize into safe classes such as rate limit, timeout, server error, auth, invalid response, unavailable, or unknown. No retry storm.

Gemini environment:
- `GEMINI_API_KEY` — GitHub Actions secret; never commit/log.
- `GEMINI_MODEL` — repository variable.

OpenAI environment:
- `OPENAI_API_KEY` — optional.
- `OPENAI_MODEL` — optional.

Cloudflare Workers AI was audited against current official REST documentation but is not implemented because this repository has no verified Cloudflare account ID/token/configuration. Do not add fake credentials or endpoints.

Article generation preserves factual-only fallback and backward compatibility. New articles may contain `generationProvider`, `generationModel`, `generationAt`, and `generationDurationMs`.

## Article Safety
AI output must have title, excerpt, and content. Output cleaning removes markdown fences/wrapper text and rejects placeholders, ellipsis, copied source-only output, and insufficient material. The prompt forbids fake quotes, reporters, interviews, witnesses, research, statistics, financial numbers, government statements, and fake chronology.

Historical repair remains Gemini-first and must skip overwrite when generation falls through to raw fallback.

## Scheduler & Publication Cadence
The preferred production timing engine is Vercel Cron when the project plan exposes a supported five-minute interval. The secure path is `/api/cron/news-publish` using `CRON_SECRET` and the same shared publication cycle.

GitHub Actions on `main` is a fallback/watchdog only. Its workflow calls the secured Vercel endpoint and must not contain a second copy of worker business logic. Its schedule is deliberately lower-frequency than the primary target and exists to recover stale publication when Vercel Cron is unavailable or delayed.

Target cadence remains approximately one publication per five minutes. Do not call the cadence verified until sequential real publication timestamps have been observed in production.

## Public Search
Canonical route: `/cari?q=keyword`.

Search reads published articles only and scores:
exact title > title contains > excerpt > content > category/source.
Tie-break: newest publication first.

`/cari` with empty query and no-result searches return HTTP 200. Search pages use `noindex, follow`, are not in sitemap/news sitemap, and do not include ads.

## SEO Architecture
`/sitemap.xml` contains the homepage, all public categories, and canonical published article URLs only.

All sitemap `lastmod` values are generated as real `Date` values from article `updatedAt`, then `sitePublishedAt`, then `createdAt`. Category lastmod is the latest real article timestamp in that category. No `new Date()` freshness fabrication is used for published URLs.

`/news-sitemap.xml` is a Google News sitemap limited to published articles from roughly the last two days and capped at 1000 URLs. It uses publication name `Berita Auto`, language `id`, real `sitePublishedAt`/`createdAt`, title, and canonical URL.

`robots.txt` exposes both sitemap URLs and disallows private admin/API/auth/preview paths.

Article pages retain canonical URLs, unique title/description, `NewsArticle` JSON-LD, publication/update dates, publisher, image, and main entity. Breadcrumb structured data should remain added when article JSON-LD is changed again.

Public internal linking remains article -> category, article -> related articles, category -> article, homepage -> articles.

## Timestamp Semantics
`sourcePublishedAt` is the source publisher timestamp; `sitePublishedAt` is Berita Auto publication time; `updatedAt` is an actual content update timestamp when available.

Public article metadata visually separates source and Berita Auto timestamps into distinct blocks. Compact cards show the publication time as `Terbit di Berita Auto` rather than placing two long timestamps side by side.

## Admin Automation / News Pipeline
`AdminWorkspace` contains a real pipeline monitor backed by `/api/admin/pipeline` and persisted worker state.

When no worker is running, UI state is `IDLE` with last completed run. It must never invent progress, fake current stage, fake provider success, or expose secrets.

Recent runs show status, stage, provider, publication result, and timestamp. Provider state is derived from actual worker metadata.

## Advertising
`components/AdSlot.jsx` remains reusable and unchanged from the verified redesign. Public phone number remains invisible; only the WhatsApp href retains the approved destination. Ads are not search results, sitemap entries, NewsArticle data, or popular articles.

## Analytics
Analytics uses Upstash Redis REST only when both Upstash variables are present. No fake analytics values are rendered when unavailable.

## Security
All admin APIs require authenticated authorized-admin email. Payloads have basic length/type validation. Secrets, database tokens, OAuth secrets, and provider keys are never returned to UI or logs.

## Git Data API Procedure
1. Fetch latest target HEAD.
2. Read current tree/files.
3. Create blobs.
4. Create a tree on the latest base tree.
5. Re-fetch HEAD immediately before commit/ref update.
6. Rebuild if HEAD changed.
7. Create commit.
8. Update ref with `force=false` only.
9. Re-fetch commit/ref and verify.
10. Never overwrite worker-generated data commits.

## Build & Verification
Required when environment permits:
- `npm ci --prefer-offline --no-audit`
- `npm run build`
- `node --check worker/run.js`
- controlled AI failover tests
- production route checks
- real cron/trigger publication verification

If local npm execution is not available, Vercel/CI build evidence must be reported exactly rather than inferred.

## DO NOT BREAK
Google OAuth, `ADMIN_EMAILS`, shared Notes persistence, source/category distribution, source filters, recent-50 distribution, dominance warning, queue/pending behavior, one-article-per-run normal cadence, adaptive catch-up, canonical URLs, redirects, article image aspect ratio, analytics, ads, robots, sitemap, and non-force Git history.

## Current Runtime Environment Names
Production/application runtime may require:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Never put actual values in source or documentation.

## Project Work Log Baseline
1. Public search 404 — resolved in current route implementation; retain regression coverage.
2. Gemini live generation — Blocked until `GEMINI_API_KEY` existence can be verified and a real publication test can run.
3. Publication cadence — Perlu Verifikasi until sequential production publication gaps are observed with the new trigger architecture.
4. Authenticated admin visual/CRUD — Perlu Verifikasi unless an authorized Google session becomes available.
5. SEO/news sitemap audit — Perlu Verifikasi until production XML is checked after the latest production deployment.
6. Persistent news datastore migration — Perlu Verifikasi until Upstash runtime is proven in Production.
7. Vercel five-minute Cron capability — Perlu Verifikasi because the current Vercel MCP does not expose the project plan/tier.
8. Production deployment of the DB-backed publication commit — Perlu Verifikasi after the latest Git-integrated deployment/build completes.

## Current Status
✅ persistent admin Notes source code
✅ shared Work Log source code
✅ real pipeline telemetry source code
✅ extensible Gemini/OpenAI provider registry
✅ public `/cari` route implementation
✅ normalized sitemap implementation
✅ Google News sitemap implementation
✅ robots sitemap exposure
✅ timestamp separation CSS/card treatment
✅ Git probe cleanup
✅ DB-backed publication storage implementation
✅ shared publication cycle and Redis publication lock
✅ secured publication endpoint
✅ GitHub fallback workflow that calls the secured endpoint
⚠️ persistent database runtime still depends on verified Upstash credentials
⚠️ Vercel five-minute Cron support/plan is not exposed by the available MCP
⚠️ latest DB-backed application deployment has not yet reached READY after the initial build fix
⚠️ publication cadence requires sequential production evidence after the new runtime is live
⚠️ authenticated admin CRUD/visual verification requires an authorized session

## Manual Setup
If Upstash is not already configured in Vercel and GitHub Actions, use the existing project Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the appropriate Vercel Production and GitHub Actions environments. Do not create a second database unless the existing backend cannot support the required persistence.

Set `CRON_SECRET` in the same secure environment before enabling the Vercel Cron or GitHub fallback trigger. Do not send the secret through chat.

If Gemini is not configured, add repository secret `GEMINI_API_KEY` and repository variable `GEMINI_MODEL`; never send the key through chat.

## Source of Truth
Current source code and production behavior win over historical conversation or documentation. Update this guide when architecture changes.
