# Project Work Log

This file records the operational baseline for the persistent Admin Work Log. The database-backed Admin Workspace is the source of truth for live status updates; this document is the repository audit snapshot.

| Issue | Type | Priority | Status | Current evidence / next verification |
|---|---|---|---|---|
| Public `/cari` previously returned 404 | Bug | High | Perlu Verifikasi | Route implemented in feature `5b221cf`; verify production after deployment |
| Gemini live generation | AI | High | Blocked | `GEMINI_API_KEY` existence is not exposed by the available connector; do not fake live result |
| Publication cadence | Scheduler | High | Perlu Verifikasi | GitHub audit shows dispatch jitter; worker telemetry now persists stage durations |
| Authenticated admin CRUD/visual | UI | Normal | Perlu Verifikasi | OAuth gate verified; authenticated session not available to this agent |
| Sitemap/news sitemap normalization | SEO | High | Perlu Verifikasi | ISO `lastmod` and `/news-sitemap.xml` implemented; verify production XML |

## Resolved implementation history

- `f87918c` — persistent admin workspace, work-log API, pipeline telemetry, public search route, sitemap/news sitemap, timestamp treatment, provider registry.
- `5b221cf` — corrected the initial `/cari` JSX parser error found by Vercel build logs.
- `b35ef71` — main scheduler passes existing Upstash REST environment to the worker and tightens scheduler timeout.

## Verification rule

An item becomes `Selesai` only after production behavior is observed. A code-only change is never sufficient to mark completion. External credentials remain `Blocked` until their existence and a safe live test are evidenced.
