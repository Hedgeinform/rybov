# Rybov

One concept-art fish per day.

Each day at 00:05 UTC, a 3-stage Claude Opus 4.7 chain (via OpenRouter) generates a single fish:
1. picks a word in any language,
2. compresses it into a sealed poetic image,
3. translates that image into DSL parameters,
which a procedural renderer then composes into an SVG poster glyph in constructivist style. The fish is committed to the repo, the static site rebuilds, and a Telegram post goes out.

- **Site:** see deployed URL in repo Pages settings
- **Telegram:** [@rybov_show](https://t.me/rybov_show)
- **Spec:** [docs/superpowers/specs/2026-04-25-rybov-design.md](docs/superpowers/specs/2026-04-25-rybov-design.md)
- **Plan:** [docs/superpowers/plans/2026-04-25-rybov-implementation.md](docs/superpowers/plans/2026-04-25-rybov-implementation.md)

## Repository structure

- `pipeline/` — TS code: DSL, renderer, storage, LLM stages, pipeline, delivery
- `web/` — Astro static site
- `fish/` — daily records (committed; one JSON + one SVG per day)
- `design-system/` — `arkadiy-ds` submodule for page chrome
- `docs/` — spec, plan, notes
- `.github/workflows/` — daily cron + web deploy

## Local development

```bash
git clone --recursive https://github.com/Hedgeinform/rybov
cd rybov
npm install
cp .env.example .env  # fill in OPENROUTER_API_KEY, TELEGRAM_*

npm test                    # pipeline unit tests
npm run verify:openrouter   # one-time: verify reasoning/caching pass-through
npm run dry-run             # full pipeline to a temp dir (no commit)
npm run dev:web             # local Astro dev server
```

## License

Private project. All rights reserved.
