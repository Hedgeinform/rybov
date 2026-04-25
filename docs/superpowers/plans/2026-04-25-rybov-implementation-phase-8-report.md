# Implementation Report: Phase 8 — Web (Astro)

**Spec:** `docs/superpowers/plans/2026-04-25-rybov-implementation.md` (Phase 8, Tasks 8.1–8.5)
**Date:** 2026-04-25
**Status:** completed

## What was done

- **Task 8.1** — `@rybov/web` workspace scaffolded. `web/package.json`, `web/astro.config.mjs` (static output, base-path env config), `web/tsconfig.json` (extends astro/strict). `astro@^4.16.0` installed at root via existing workspace. Placeholder index page builds.
- **Task 8.2** — `web/scripts/copy-ds.mjs` predev/prebuild script copies `tokens.css` + `typography.css` + the 12 self-hosted woff2 fonts from `design-system/arkadiy-ds/` into `web/public/arkadiy-ds/`. Default layout (`web/src/layouts/Default.astro`) loads tokens + typography, sets `<html data-theme="dark">`, contains the global stylesheet for fish-figure (hosted-artefact frame per DS v0.6 §3a), concept-card grid, and archive contact-sheet grid.
- **Task 8.3** — `web/src/lib/fish-loader.ts` (build-time read from `<repo>/fish/`), `web/src/components/Fish.astro` (figure + mono fig-label), `web/src/components/ConceptCard.astro` (Слово / Рыба / DSL three-row mono-label grid).
- **Task 8.4** — Today (`index.astro`), Permalink (`[date].astro` with `getStaticPaths`), Archive (`archive.astro`). Archive upgraded from text list to contact-sheet grid per §3a end-note.
- **Task 8.5** — Topbar (Euler + AS monogram per §8, theme toggle, archive nav) and Footer (single mono-strip with GitHub link). Both mounted in Default layout.

## Deviations from spec

- **D1 — figure sizing:** Spec used `width: fit-content` on `figure.fish-figure`, which assumed the SVG carried explicit `width="200" height="140"` attributes. Commit [3bfe7bd](https://github.com/Hedgeinform/rybov/commit/3bfe7bd) (earlier in this session) made the SVG fluid (viewBox-only, no width/height attrs) per DS v0.6 §3a. Replaced with `max-width: min(100%, 600px)` on the figure, `width: 100%; height: auto` on the SVG. Aspect ratio held by viewBox.
- **D2 — archive layout:** Spec had archive as a flat text list (date + word). DS v0.6 §3a end-note legitimises a contact-sheet grid for the «artefact IS the page» case. Implemented as a CSS grid with `repeat(auto-fill, minmax(220px, 1fr))` — settles on 4–5 columns at editorial width, falls to 1–2 on mobile. Each cell is an inline-SVG thumbnail + mono caption (date + word); empty days get a placeholder cell at the same aspect ratio so grid rhythm holds.
- **ConceptCard typing:** Spec imported `Stage1Output` / `Stage2Output` / `Stage3Output` from `pipeline/src/storage/storage.ts`. Replaced with local interfaces in `ConceptCard.astro` to avoid cross-workspace TS coupling. The fish-loader already loose-types `record: any` at the storage boundary; the component matches.
- **Footer scope:** Spec referenced the four-column DS footer template (`{{COLUMNS}}`). Implemented as a simplified single mono-strip — for a one-fish-per-day site the four-column footer is overkill and the strip variant matches §3 rule 7 (no chrome that would compete with the artefact above).

## Issues discovered

- **DS v0.6 §3a was added after the spec was written.** The original Phase 8 plan didn't account for the «hosted artefact» frame contract or the «artefact IS the page» gallery-relaxation rule. Both were applied in this implementation (D1, D2). Future spec amendments should reference §3a directly.
- **Topbar nav slot count:** Spec template had 3 nav slots (`{{NAV_1}}`, `{{NAV_2}}`, `{{NAV_3}}`). Rybov has only one meaningful nav target (Архив) — the other two would be filler. Reduced to one nav link.
- **OG image path drift (out of scope but flagged):** [pipeline/src/publishing/publishing.ts:47](../../pipeline/src/publishing/publishing.ts) sets `image: ${permalinkUrl}.svg` — Telegram/Twitter/FB do not render SVG OG previews. Phase 9 builds the SVG→PNG converter; once the PNG path lands, publishing.ts must be updated to point at `.png`. Recorded in spec as Phase-9 dependency.
- **Visual verification deferred:** Build is structurally verified (DOM markers present in dist HTML, all pages produced). Visual fidelity (font load, theme toggle, contact-sheet layout under real viewport) was not opened in a real browser during this session — autonomous mode lacks a screenshot tool. To be confirmed by operator on first preview.

## Open items

- **Phase 9 — Telegram delivery.** SVG→PNG converter via `@resvg/resvg-js`, bot post script, OG image path update in `publishing.ts`.
- **Phase 10 — Automation.** Daily cron workflow, web deploy workflow, repo secrets configuration (the secrets step is manual operator work — not autonomously executable).
- **Phase 11 — README + first real fish.** Project README, end-to-end first run committing a real fish to `fish/`.
- **Visual spot-check** of Phase 8 output (theme toggle, font load, contact-sheet aesthetics) — operator action.
