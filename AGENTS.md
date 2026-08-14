# Berita Auto Agent Instructions

1. Read `/SKILL.md` completely before editing.
2. Fetch the latest repository and confirm the target branch before every change.
3. Application branch: `feature/auto-news-mvp`.
4. Scheduler/default branch: `main`.
5. Production branch: `feature/auto-news-mvp`.
6. Never force-push or force-update a ref.
7. Re-fetch HEAD immediately before `update_ref`; rebuild the tree if HEAD changed.
8. Preserve Google OAuth, `ADMIN_EMAILS`, Personal Notes, canonical URLs, old redirects, RSS/pending dedupe, one-at-a-time publishing, robots, sitemap, and advertising CTA.
9. Run real build/test commands when possible and report exact failures.
10. Never expose or commit secrets.
11. Pending candidates live in `data/pending-articles.json`; published articles live in `data/articles.json`.
12. Ingestion is separate from publication. A worker run publishes at most one article.
13. Never fabricate reader views, geo data, quotations, reporters, interviews, facts, or credentials.
14. Analytics code is optional and activates only when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured.
15. Admin source distribution must be derived from real published article `sourceName` data; never hardcode source counts or include pending candidates.
16. Source distribution and Source Monitor have different semantics: distribution measures published article contribution, while Source Monitor measures feed/source health and fetching state.
17. Gemini is the primary article-generation provider; OpenAI is optional secondary; AI failures must never stop the one-article publication run because factual non-AI fallback is the final path.
18. Provider metadata must reflect the actual generation path; never fabricate AI success, model names, credentials, or pipeline status.
19. Public advertising UI must never render the WhatsApp phone number as visible text; keep the existing number only inside the CTA href.
20. Read `/SKILL.md` for the exact Git Data API, scheduler, queue, analytics, AI generation, deployment, maintenance, advertising, and admin distribution procedures.
