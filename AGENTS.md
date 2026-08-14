# Berita Auto Agent Instructions

1. Read `/SKILL.md` completely before editing.
2. Work from the latest repository state; old conversation context is not source of truth.
3. Application branch: `feature/auto-news-mvp`.
4. Scheduler branch: `main`.
5. Never force-push or force-update a ref.
6. Re-fetch HEAD immediately before `update_ref`; rebuild the tree if HEAD changed.
7. Preserve Google OAuth, `ADMIN_EMAILS`, Personal Notes, SEO/canonical URLs, RSS dedupe, queue dedupe, and one-at-a-time publishing.
8. Run build/test where available and report real results.
9. Update `/SKILL.md` whenever architecture changes.
10. Never expose or commit secrets.
11. Published data lives in `data/articles.json`; pending candidates live in `data/pending-articles.json`.
12. Ingestion is separate from publication: at most one article is published per worker run.

Full project architecture, Git Data API commit procedure, scheduler, queue, deployment, SEO, and known blockers are documented in `/SKILL.md`.
