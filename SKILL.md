# Berita Auto

## Project Identity
Repository: `projectdaaw-bot/berita-auto`
Production: `https://berita-auto.vercel.app`
Admin: `https://berita-auto.vercel.app/admin-berita`
Stack: Next.js 15.5.7, React 19.1, NextAuth v5 beta, Node 22 in GitHub Actions.

## Branch Strategy
Application: `feature/auto-news-mvp`
Scheduler/default: `main`
Production branch: `feature/auto-news-mvp`; never change it to `main`.
Never force-push or force-update refs.

## Core Architecture
Official RSS -> normalize/dedupe/classify -> pending queue -> deterministic source-rotation selection -> source material -> provider registry (Gemini -> optional OpenAI) -> factual fallback -> image enrichment -> persistent publication storage.

When Upstash Redis is configured, it is the live source of truth for published articles and the pending queue. GitHub JSON files are migration/backup snapshots, not the live production datastore.

Publication service: `/api/cron/news-publish` -> `runPublicationCycle({trigger, now})` in `worker/run.js`. The endpoint authenticates with `CRON_SECRET`, uses the shared Redis publication lock, runs the normal queue/AI/image pipeline, persists the result, records telemetry, and releases the lock. It never performs Git operations.

## Multi-source News Ingestion
Source registry is the single source of truth in `lib/sources.js` and exports `NEWS_SOURCES` plus the enabled `sources` list. Every source has a stable `id`, `publisher`, `name`, official feed `url`, website `category`, `weight`, `enabled`, and language metadata.

Active publisher groups:
- ANTARA
- Liputan6
- CNN Indonesia
- CNBC Indonesia
- Media Indonesia
- Tribunnews

Current official feed endpoints are maintained in `lib/sources.js`. Feed discovery uses RSS/Atom only; no HTML scraping is part of the ingestion path. Feed failures are isolated per source and logged without failing the complete cycle.

Source validation rules:
- prefer an official publisher RSS/Atom/API endpoint;
- do not add third-party proxy feeds when an official feed exists;
- keep only metadata, summaries and source links needed for aggregation;
- never copy full source articles into the repository or published content;
- preserve `sourceId`, `publisher`, `sourceName`, and `sourceUrl` on queued/published records;
- source timestamps and Berita Auto publication timestamps remain distinct.

`lib/rss.js` fetches sources concurrently with a seven-second per-source timeout and returns source-level telemetry. A timeout, HTTP error, malformed feed, or empty feed produces a source failure/zero-item result rather than aborting the whole ingestion cycle.

## Dedupe
`worker/normalize.js` keeps a normalized canonical URL fingerprint and a normalized title fingerprint. Cross-source duplicates are rejected when either stable URL identity or normalized title identity already exists in published/pending state.

The stable URL fingerprint remains SHA-256 based for backward compatibility. Title fingerprints are deterministic and inexpensive; semantic/AI dedupe is intentionally not required.

## Category Mapping
Use only categories already defined in `lib/categories.js`:
`Nasional`, `Internasional`, `Ekonomi`, `Bisnis`, `Teknologi`, `Olahraga`, `Hiburan`, `Lifestyle`, `Otomotif`, `Sains`, `Politik`, `Daerah`.

Feed/category hints are used first when they map to an existing category; otherwise the existing keyword classifier supplies the category.

## Source Rotation
`worker/strategy.js` applies deterministic source diversity scoring. It considers freshness, breaking-news relevance, category diversity, source weight, recent publisher use, consecutive-publisher use, and recent publisher share.

Rules:
- normal cadence remains one publication per run;
- no more than two consecutive publications from the same publisher when alternatives are available;
- the recent ten-publication window penalizes publishers at or above a 35% share;
- recently unused publishers receive a deterministic diversity bonus;
- freshness/quality wins when alternatives are unavailable;
- catch-up can publish 2/3/5 articles according to the existing adaptive outage policy, and the history is updated after each publication so the same source is not repeatedly selected inside one catch-up run.

Telemetry logs publisher distribution for the recent publication window. Admin source distribution continues to use real persisted article state.

## Queue and Publication
`worker/strategy.js` keeps the existing queue bounds and adaptive policy:
- low watermark 30
- target 60
- maximum 120
- freshness cutoff 12 hours
- normal/delayed/stale/long-outage publication maxima: 1/2/3/5
- hard maximum 5

Pending candidates are never public. `sitePublishedAt` is the actual Berita Auto publication time; never synthesize cadence timestamps.

## Persistence
Persistence adapter: `lib/persistence.js` using the existing Upstash Redis REST configuration.

Live keys:
- `ba:news:articles`
- `ba:news:pending`
- `ba:news:publication-lock`
- existing `ba:pipeline:*` keys

Production must fail closed when persistent storage is unavailable. Never overwrite `data/articles.json` or `data/pending-articles.json` from an application feature commit.

The publication lock is Redis `SET ... NX EX` and is shared by QStash, GitHub fallback, and recovery triggers. Never replace it with an in-memory/global lock.

## Article Metadata
`sourcePublishedAt` = publisher's original publication timestamp.
`sitePublishedAt` = Berita Auto publication timestamp.
`updatedAt` = actual content update timestamp when available.

Published records also retain `publisher`, `sourceName`, `sourceId`, `sourceUrl`, canonical article URL, fingerprint, and title fingerprint. `publishedAt` remains source-time-compatible for existing records.

## AI Provider Architecture
`lib/ai-providers.js` uses Gemini primary, optional OpenAI secondary, and factual non-AI fallback. AI is never a hard dependency for publication. Provider metadata must reflect the real generation path.

Never log or commit provider credentials or raw credential-bearing responses.

## Scheduler
**Primary scheduler: QStash.** It targets `GET https://berita-auto.vercel.app/api/cron/news-publish` with `Authorization: Bearer <CRON_SECRET>` forwarded securely. Target cadence: `*/5 * * * *`.

**Fallback/watchdog: GitHub Actions on `main`.** `.github/workflows/feature-branch-scheduler.yml` calls the same secured production endpoint and contains no duplicate publication business logic. It must remain lower-frequency than QStash (target approximately `7,22,37,52 * * * *` once QStash stability is proven). `.github/workflows/auto-news.yml` is legacy and is not the production scheduler.

All triggers call the same `runPublicationCycle`. Do not create a second worker path.

## Admin / Pipeline
Admin source distribution is calculated from persisted published articles. It must show real publisher counts and percentages, not synthetic values. The Automation / News Pipeline tab must expose actual worker state, provider metadata, publication result, and timing.

Admin APIs require server-side authentication and authorization with the existing Google OAuth and `ADMIN_EMAILS` rules.

## Timestamp / SEO / Search Invariants
Keep existing canonical URLs, sitemap/news-sitemap timestamps, robots behavior, published-only search, article JSON-LD, image proportions, analytics, ads, and category/source filters intact.

Sitemap timestamps must use real article timestamps. Search remains HTTP 200 for empty/no-result queries and remains `noindex, follow`.

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

## Build and Verification
When the environment permits, run:
- `npm ci --prefer-offline --no-audit`
- `npm run build`
- `node --check worker/run.js`
- `node worker/source-verification.js`
- existing tests/lint only if present in `package.json`
- production route checks
- real scheduler/publication verification

Do not claim a check passed without evidence.

## Source Research Record
The initial source research found official/known publisher feed endpoints for the active registry. Web validation showed ANTARA and Liputan6 endpoints returning XML to the fetch layer, while CNN Indonesia and CNBC Indonesia currently return HTTP 403 to the web fetcher. Historical Tempo RSS endpoints also return HTTP 403, so Tempo was not added to the active registry. Third-party feed directories were used only to discover candidate URLs, not as runtime ingestion sources.

## Security
Never print or commit `CRON_SECRET`, Upstash tokens, QStash tokens, OAuth secrets, Gemini/OpenAI keys, or `.env` files. If a secret is found in repository history, treat it as a security issue without repeating its value.

## Definition of Done
Multi-source ingestion, source isolation, cross-source dedupe, deterministic rotation, metadata separation, Redis persistence, build/tests, atomic commit, READY production deployment, runtime publication, multi-publisher production evidence, Admin Pipeline, scheduler evidence, and required documentation must all be verified before declaring completion.

## Source of Truth
Current source code and verified production behavior win over historical conversation or stale documentation. Update this guide when architecture changes.
