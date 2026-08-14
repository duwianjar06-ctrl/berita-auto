# Berita Auto Agent Instructions

1. Read `/SKILL.md` completely before editing.
2. Fetch latest HEAD for the target branch immediately before making commits and immediately before updating refs.
3. Application branch: `feature/auto-news-mvp`; scheduler/default: `main`; production: `feature/auto-news-mvp`.
4. Never force-push or force-update refs. Use `force=false`.
5. Preserve Google OAuth, `ADMIN_EMAILS`, shared persistent Notes, source/category distribution, queue/pending data, one-at-a-time publishing, canonical URLs, article image proportions, sitemap/robots, analytics, and verified advertising behavior.
6. Never overwrite `data/articles.json` or `data/pending-articles.json` from an application feature commit.
7. Admin APIs must authenticate and authorize server-side. Never treat UI hiding as authorization.
8. Persistent Notes/Work Log require the existing approved database backend; never fall back to localStorage as source of truth, filesystem, memory globals, or Vercel ephemeral storage.
9. Never mark a Work Log item `Selesai` without production evidence. Keep unresolved blockers visible.
10. Pipeline telemetry must come from actual worker state. Never fake progress, provider success, timing, queue counts, or scheduler metrics.
11. Gemini is primary; OpenAI is optional secondary; factual fallback is mandatory. Provider metadata must reflect the real generation path.
12. Never expose or commit API keys, OAuth secrets, database tokens, or raw provider responses containing credentials.
13. Use bounded retries/timeouts only. Keep the one-publication-per-run and single-writer scheduler semantics.
14. Search is published-article-only, noindex/follow, HTTP 200 for empty/no-result, and never includes ads or sitemap entries.
15. `sitemap.xml` and `news-sitemap.xml` must use real article/category timestamps; never fabricate freshness with `new Date()` per URL.
16. Keep source timestamp, Berita Auto publication timestamp, and update timestamp semantically distinct and visually separated.
17. When a new problem appears, record/update it in the Admin Project Work Log instead of hiding it in the final response.
18. Run real build/tests when the environment allows them. When blocked, cite the exact CI/Vercel evidence and do not claim success.
19. Use atomic Git Data API trees/commits where practical and verify the resulting SHA and production deployment before declaring completion.
20. Read `/SKILL.md` for the full architecture, persistence, scheduler, SEO, AI, Work Log, Admin Monitor, and deployment procedures.
