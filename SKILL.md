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
Official RSS -> normalize/dedupe/classify -> pending queue (`data/pending-articles.json`) -> select one -> source material -> Gemini/OpenAI/factual fallback -> image enrichment -> published store (`data/articles.json`) -> Next.js/Vercel.

Ingestion and publication remain separate. Worker intake may add 24 or 48 candidates; one worker run publishes at most one article.

## Queue and Publication
Configuration in `worker/strategy.js`:
- normal ingestion max: 24
- catch-up ingestion max: 48
- queue target: 60
- low watermark: 30
- queue max: 120
- max publications per run: 1
- freshness cutoff: 12 hours
- RSS concurrency: 8
- AI timeout: 18s
- source material timeout: 5s

Production cron: `2-59/5 * * * *`.
Pending candidates are not public and are excluded from homepage, categories, article reads, analytics ranking, sitemap, and admin published distribution. A candidate leaves pending only after successful publication.

## Sources and Categories
`lib/sources.js` + `lib/sources-extra.js` define the official/reliable RSS source set. Never invent RSS URLs.
Categories: Nasional, Politik, Ekonomi, Bisnis, Internasional, Teknologi, Olahraga, Hiburan, Lifestyle, Otomotif, Sains, Daerah.
`worker/category.js` uses dedicated-feed confidence plus contextual keyword scoring.

## AI Article Generation Providers
`lib/ai.js` is the single provider/fallback path used by the publication worker and historical repair.

Provider order:
1. Gemini primary when `GEMINI_API_KEY` is configured.
2. OpenAI secondary when `OPENAI_API_KEY` is configured.
3. Factual non-AI fallback.

Cloudflare Workers AI is not implemented because no current project credential/configuration justified adding another provider.

### Gemini
Environment:
- `GEMINI_API_KEY` — GitHub Actions secret only; never commit or log it.
- `GEMINI_MODEL` — GitHub Actions repository variable; defaults to `gemini-2.5-flash-lite`.

The default model is currently listed by Google as the stable `gemini-2.5-flash-lite` model with structured output support. Google currently lists a shutdown date of October 16, 2026 and recommends `gemini-3.1-flash-lite`, so `GEMINI_MODEL` must remain configurable and should be migrated before that date.

Gemini is called through the Google Generative Language API with `x-goog-api-key`. Structured JSON output requests `title`, `excerpt`, and `content`.

### OpenAI
Environment:
- `OPENAI_API_KEY` — optional secret.
- `OPENAI_MODEL` — optional repository variable; default `gpt-4o-mini`.

OpenAI is secondary only and is never a publication blocker.

### Provider failure behavior
Provider failures are classified as rate-limited, timeout, server error, invalid response, unavailable, or generic failure. No infinite retries. A failed Gemini call moves to OpenAI when configured, then to factual fallback. A provider failure never changes the one-publication-per-run rule.

No API response body or credential is logged. Logs use safe status labels such as `provider=gemini status=rate_limited` and `provider=fallback status=used`.

### Article validation
AI output must contain non-empty title, excerpt, and content. The validator removes markdown JSON fences/wrapper text, rejects placeholders and artificial `...`, requires multiple paragraphs based on material length, rejects content that is effectively copied source material, and requires sufficient length when factual material is sufficient.

The prompt forbids fabricated quotes, interviewees, reporters, eyewitnesses, locations, research, statistics, financial figures, government statements, chronology, or claims of on-location reporting. Direct quotes may only survive when actually present in source material.

Returned metadata:
- `generationProvider`
- `generationModel`
- `generationAt`

Existing articles without these fields remain backward-compatible.

### Factual non-AI fallback
Fallback uses only available factual pieces: article title, RSS summary, extracted source-material paragraphs, source attribution, and source URL. It does not invent facts. When material is insufficient, the fallback remains short rather than fabricating detail.

## Historical Article Repair
`worker/repair.js` detects suspiciously short or ellipsis-truncated articles and calls the same Gemini -> OpenAI -> fallback generation path.
Historical repair is safer than normal publishing: if generation ends in `fallback`, repair is skipped and the historical article is not overwritten with a raw/non-AI replacement.
Command: `npm run news:repair`.

## Homepage Editorial Intro
The homepage `BERITA HARI INI` section is an editorial introduction explaining the multi-source value proposition without claiming complete internet coverage.

Current direction: explain that important news from various public sources is available in one place, reduce the need to open many publisher sites, and show compact supporting indicators.

Dynamic source count is computed from current published article `sourceName` values. Category count uses the existing category architecture. No source count is hardcoded.

The intro uses CSS/SVG-style geometry only, with subtle fade/stagger motion. It must respect `prefers-reduced-motion`, remain readable on mobile, and avoid fake `LIVE` indicators.

## Advertising UI Policy
`components/AdSlot.jsx` is the reusable advertising component for leaderboard, rectangle/sidebar, inline-article, and footer placements.

Public ad copy should be professional and clearly labeled `IKLAN`. The existing WhatsApp number must never appear as visible text. The number may remain only inside the approved WhatsApp href.

CTA label: `Pasang Iklan ↗` or equivalent professional wording. External WhatsApp links opened in a new tab use `rel="noopener noreferrer"`.

`components/ads.css` supplies the lightweight shared ad visual system: gradients, abstract editorial document/spotlight shapes, soft transitions, responsive stacking, and reduced-motion support. No stock image, GIF, video, heavy animation library, or copyrighted visual asset is required.

Ads are not articles. They must not be included in public search results, sitemap entries, NewsArticle JSON-LD, or popular-article ranking. Existing search, sitemap, and analytics implementations therefore remain unchanged.

## Article Detail
`app/berita/[slug]/page.jsx` renders every body paragraph and preserves source attribution, source time, site publication time, related articles, ads, share links, and NewsArticle JSON-LD. Do not introduce body truncation.

The article-detail image aspect-ratio policy is an existing compatibility requirement: preserve the source image proportions rather than redesigning article hero media for the homepage treatment.

## Analytics
Analytics is optional and uses Upstash Redis REST only when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` exist. No fake analytics values are rendered when unavailable.

## Admin
`/admin-berita` remains protected by Google OAuth and `ADMIN_EMAILS`. Personal Notes remains `components/admin/AdminNotes.jsx`.

### Admin Distribution Dashboard
The existing `Distribusi Kategori` remains first, with `Distribusi Sumber Berita` directly below it. Source distribution is derived from real published `article.sourceName` data through `lib/admin-source-distribution.js`, excludes pending candidates, handles missing source names as `Sumber tidak diketahui`, sorts by count, and supports source filtering with existing query-state. Recent-50 distribution and >50% dominance warning are preserved.

No rebuild of the source distribution architecture is permitted unless a new requirement actually needs it.

### Admin News Pipeline
No dedicated Admin News Pipeline component was present in the audited current repository. Do not invent mock pipeline states. If a real pipeline monitor is added later, AI provider/model/state must derive from actual worker state or published `generationProvider` metadata and must never expose secrets.

## Persistence and Vercel
`lib/storage.js` reads published/pending JSON from the feature branch raw GitHub content. Git remains the persistence channel for worker publication.
`vercel.json` suppresses UI rebuilds for data-only changes to `data/articles.json` and `data/pending-articles.json`; code commits still deploy.

## Scheduler
Canonical workflow: `main/.github/workflows/feature-branch-scheduler.yml`.

The scheduler checks out `feature/auto-news-mvp`, uses Node 22, runs `npm ci --prefer-offline --no-audit`, runs `npm run news:run`, stages only published/pending data, rebases on the latest feature branch, and pushes non-force.

Gemini scheduler env:
- `GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}`
- `GEMINI_MODEL: ${{ vars.GEMINI_MODEL }}`

Optional OpenAI scheduler env:
- `OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}`
- `OPENAI_MODEL: ${{ vars.OPENAI_MODEL }}`

Never claim a secret is configured unless a connector exposes proof. Code readiness and secret configuration are separate states.

## Git Data API Procedure
1. Fetch latest target HEAD.
2. Fetch current files/tree.
3. Create blobs.
4. Create tree on current base.
5. Re-fetch HEAD immediately before commit/ref update.
6. If HEAD changed, rebuild tree/commit on newest HEAD.
7. Create commit.
8. Update ref with `force=false` only.
9. Re-fetch committed files/commit and verify.
10. Never overwrite worker-generated data commits.

## Build and Test
Required commands:
- `npm ci --prefer-offline --no-audit`
- `npm run build`
- `npm run news:run`
- `npm run news:repair`

Controlled AI tests should cover Gemini success, missing key, 429, timeout, invalid response, 5xx, optional OpenAI failover, and factual fallback without consuming production quota.

## DO NOT BREAK
Google OAuth, `ADMIN_EMAILS`, Personal Notes, article IDs/fingerprints/slugs, canonical URLs, old redirects, RSS/pending dedupe, one-at-a-time publisher, sitemap, robots, Google verification, source distribution, source filtering, analytics, carousel, article full content, image behavior, production branch, and non-force Git history.

## Source of Truth
Current repository code wins over conversation history. Documentation must be updated when architecture changes.

## Current Implementation Status
✅ multi-source RSS ingestion and queue
✅ queue target 60 / low watermark 30 / max 120
✅ one publication per worker run
✅ existing category/source distribution and source filtering
✅ recent-50 source distribution and domination warning
✅ Gemini-first article generation code
✅ optional OpenAI secondary path
✅ factual non-AI fallback
✅ generation metadata on new publications
✅ historical repair refuses fallback overwrite
✅ redesigned `BERITA HARI INI` homepage intro
✅ reusable responsive AdSlot redesign
✅ public ad phone number removed from AdSlot markup
✅ reduced-motion rules for new intro/ad styles
⚠️ live Gemini generation requires `GEMINI_API_KEY` to be configured in GitHub Actions; connector cannot prove secret existence
⚠️ Gemini default model `gemini-2.5-flash-lite` is currently stable but Google lists shutdown on October 16, 2026; keep `GEMINI_MODEL` configurable and migrate before shutdown
⚠️ no dedicated Admin News Pipeline component exists in the audited repository, so no mock provider panel was added

## Last Verified
Feature branch HEAD: update after final commit.
Main branch: update after scheduler env commit if changed.
Production deployment: update after final READY deployment.
