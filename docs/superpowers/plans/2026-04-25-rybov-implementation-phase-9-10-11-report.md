# Implementation Report: Phases 9–11 (Telegram, Automation, README)

**Spec:** `docs/superpowers/plans/2026-04-25-rybov-implementation.md` (Phases 9, 10, 11)
**Date:** 2026-04-25
**Status:** completed (code-side); operator-side prerequisites remain

## What was done

### Phase 9 — Telegram delivery

- **Task 9.1** — `pipeline/src/delivery/png.ts` wraps `@resvg/resvg-js`. `fitTo: { mode: 'width', value: 800 }` so the fluid (viewBox-only) SVG produced by the renderer rasterises at a predictable size without needing intrinsic width/height attrs. Three unit tests verify PNG magic bytes, target width, aspect-ratio preservation.
- **Task 9.2** — `pipeline/src/delivery/telegram.ts` (raw Bot API `sendPhoto` multipart upload + HTML-escaping caption builder), `pipeline/src/scripts/post-tg.ts` (read fish, rasterise, post, log). Wired as `npm run post-tg [date]` at root and pipeline workspace. Caption builder unit-tested for escape and structure.

### Phase 10 — Automation

- **Task 10.1** — `.github/workflows/daily-fish.yml`. cron `5 0 * * *` UTC + `workflow_dispatch`. Steps: checkout (submodules: recursive) → `npm ci` → `npm run daily` → commit + push fish/ delta → `npm run post-tg`.
- **Task 10.1a** — `post-tg.ts` empty-day branch returns 0 instead of 1, so the workflow stays green when `npm run daily` produced an empty-day marker.
- **Task 10.2** — `.github/workflows/deploy-web.yml`. Triggers on push to master under `fish/**` / `web/**` / `design-system/**` / npm files + manual dispatch. GitHub Pages deploy (`actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`). Concurrency group `pages` with cancel-in-progress.

### Phase 11 — README

- **Task 11.1** — `README.md` at repo root with project pitch, structure, local-dev loop, links to spec + plan + Telegram channel.

## Deviations from spec

- **Telegram caption builder is exported separately** (`buildCaption`) and unit-tested as a pure function, rather than inlined into the post script. Plan had it inline; splitting makes it testable without mocking fetch.
- **`RYBOV_SITE_URL` is required** in `post-tg.ts` (no implicit `https://hedgeinform.example/rybov_show` fallback). Reason: the placeholder fallback would have silently posted with a broken permalink. Better to fail loudly until the operator sets it.

## Issues discovered

- **OG image still points at .svg** — [pipeline/src/publishing/publishing.ts:47](../../pipeline/src/publishing/publishing.ts) sets `image: ${permalinkUrl}.svg`, but the static site only inlines the SVG into pages, doesn't serve `.svg` at a public URL. Telegram/Twitter/FB also won't render SVG OG previews. Fix is two-step: (a) update `publishing.ts` to `.png`, (b) extend `web/scripts/copy-ds.mjs` (or a sibling script) to copy `fish/<date>.png` into `web/public/<date>.png` so the static URL resolves; (c) generate the `.png` in `daily.ts` alongside `.svg` so a `.png` is on disk to copy. Deferred as a follow-up — Phase 9 is functional for Telegram delivery without it; only the static-page social-preview is degraded.
- **No CI test step in workflows.** `daily-fish.yml` and `deploy-web.yml` skip running unit tests before doing real work. For a first deploy this is acceptable (manual gate via local `npm run test:run`); for steady-state it is a hole. Add `npm run test:run` ahead of `npm run daily` and `npm run build:web` once the workflows are validated end-to-end.
- **Cron `5 0 * * *` is UTC-fixed.** The spec deliberately picks 00:05 UTC (early-morning EU, late-evening Asia, mid-night Americas). If the operator wants a different fixed time-zone alignment later, this is one-line change.

## Open items

### Operator action required (cannot be automated):

- **Task 9.3 — Telegram smoke test.** Create bot via `@BotFather`, create channel, add bot as admin with "Post Messages", get channel ID. Add `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` to local `.env`. Run `npm run post-tg` against an existing fish. Verify the post arrives.
- **Task 10.3 — GitHub repo configuration.**
  - Enable Pages source: GitHub Actions (in `Settings > Pages`).
  - Repo secrets (`Settings > Secrets and variables > Actions`): `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`.
  - Repo variables (`Settings > Secrets and variables > Actions`): `RYBOV_SITE_URL`, `RYBOV_BASE_PATH`.
  - Manually trigger `Daily fish` workflow once to validate end-to-end.
- **Task 11.2 — First real fish.** After 9.3 + 10.3 are configured, run `npm run daily` locally OR trigger the cron. The first commit lands in `fish/<date>.json` + `.svg`, the deploy workflow ships the site, and the Telegram post goes out. Verify all three.

### Code follow-ups:

- **OG image static URL.** Implement the three-step fix described under "Issues discovered" so social previews work.
- **CI test step.** Add `npm run test:run` to both workflows before the production work step.
- **Schema-fixture modernisation.** Test sample records in `tests/storage/storage.test.ts`, `tests/publishing/publishing.test.ts`, `tests/storage/antirepeat.test.ts` use the pre-extension DSL shape (no `head`, signature missing `head_primitive`/`tail_primitive`, fins missing `tilt`). Tests pass at runtime because storage doesn't validate, but TypeScript would error if strict-checked. Tech debt from the DSL extension; cleanup before any storage refactor.
- **Visual verification of Phase 8.** Operator action — open the local preview (`npm run dev:web`) once a fish exists in `fish/` and confirm the page chrome, theme toggle, and contact-sheet aesthetics under a real viewport.
