# Berita Auto

Portal berita otomatis berbasis Next.js.

## Production
Production Branch: `feature/auto-news-mvp`
Production URL: https://berita-auto.vercel.app

## Fitur
- RSS news collection every 5 minutes via GitHub Actions.
- Duplicate detection by source fingerprint.
- JSON article storage in `data/articles.json`.
- AI article generation with `OPENAI_API_KEY`.
- Category detection.
- API `GET /api/articles`.

## Setup
Add `OPENAI_API_KEY` as a GitHub Actions secret. Optionally add `OPENAI_MODEL` as a repository variable. Run the `Auto News` workflow manually once to test it.

Without an API key, the worker creates a safe fallback article from the source summary.
