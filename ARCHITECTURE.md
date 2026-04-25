# Rybov — Architecture

Живой документ. Описывает текущее состояние проекта, принятые решения и
зафиксированные архитектурные обязательства. Обновляется в момент принятия
архитектурного решения, не «потом».

Глобальные архитектурные принципы — в `~/.claude/architecture/global-principles.md`.
Они применяются по умолчанию ко всему проекту. Ниже — только project-specific
принципы, overrides и состояние.

---

## Current Status — 2026-04-26

End-to-end pipeline работает: ежедневный cron генерирует одну рыбу через
3-stage Claude Opus chain, коммитит её в `fish/`, постит превью в Telegram-канал
и переразвёртывает статический сайт. Первая боевая рыба зафиксирована
(коммит `45d26f1`, дата `2026-04-25`).

**Работает end-to-end:** Stage 1/2/3 LLM, DSL→SVG renderer, atomic daily
orchestrator, fluid SVG output, SVG→PNG converter, Telegram bot delivery,
Astro static site (today / permalink / archive), GH Actions cron + deploy.

**В процессе / недоделано:** см. Known Drift и Open Questions.

**Текущий фокус:** наблюдение за качеством Stage 2 + 3 на серии реальных
ежедневных запусков; iterations по необходимости. Структурно проект
закрыт по плану `docs/superpowers/plans/2026-04-25-rybov-implementation.md`.

---

## Stack

Архитектурные компоненты проекта, для которых применяются стек-специфичные
правила из `~/.claude/architecture/stacks/`.

- **TypeScript** — основной язык pipeline + web
- **Node.js 22** — runtime; используется `--env-file-if-exists` (>=22.4)
- **Astro 4** — статический генератор сайта
- **OpenRouter** — gateway к Claude Opus 4.7 (через `anthropic/claude-opus-4.7`)
- **Claude Opus 4.7** — единственная LLM, используется на всех трёх стадиях
- **vitest** — unit-тесты pipeline-кода
- **zod** — валидация DSL и Stage 1 output schema
- **@resvg/resvg-js** — SVG → PNG конвертер для Telegram-доставки
- **arkadiy-ds (v0.7)** — design-system submodule, page chrome
- **GitHub Actions** — CI/CD (daily-fish.yml + deploy-web.yml)
- **GitHub Pages** — хостинг сайта (custom domain `rybov-show.hedgeinform.ru`)
- **Telegram Bot API** — delivery в публичный канал

Стек-специфичных правил нет ни для одного из перечисленных компонентов
(нет файлов в `~/.claude/architecture/stacks/` для них на момент создания
этого документа).

---

## Topic Index

<!-- Индекс концептов, упоминаемых в нескольких секциях документа.
     Формат: - **concept_name** [aliases: synonym1, synonym2] — D1, OQ2, Section § anchor

     Пуст на старте. При появлении второй записи об одном концепте
     architecture-skill предложит зарегистрировать его здесь автоматически. -->

---

## Project-specific принципы

Применяются в дополнение к глобальным (`~/.claude/architecture/global-principles.md`).

1. **«Pretext is a fish, the artifact is a printer's mark».** Output —
   конструктивистский плакатный глиф, не биологическое изображение рыбы.
   Анти-реализм — активная design force на Stage 3, не побочный эффект.
   Эллипс body разрешён только для семантики liquidity/dissolution; motion
   verbs (плывёт, дрейфует) сами по себе не лицензируют ellipse.

2. **«Dumb → Smart → Dumb» three-stage pipeline.** Stage 1 stateless word
   draw (temp 1.0, anti-trope guard). Stage 2 creative compression
   (temp 0.9, single poetic image, no symbolism explanation). Stage 3
   mechanical translation в DSL (temp 0.3, validator-feedback retries,
   decision procedure, anti-bias на ellipse). Творчество зажато
   между двумя «слепыми» стадиями.

3. **Atomic daily run.** Каждый день pipeline пишет либо один полный fish
   record (json + svg), либо один empty-day marker (json с reason/failed_stage).
   Никогда не остаётся частичное состояние в `fish/`.

4. **No anti-repeat at Stage 3.** Сознательный отказ — сохраняет концепцию
   «один независимый генератор в день». Anti-repeat на Stage 1 (по словам)
   допустим и реализован; на Stage 3 (по примитивам) — запрещён.

5. **DS-as-frame, не DS-as-interior.** Page chrome регулируется arkadiy-ds
   (warm-coal + coral, §3a Hosted artefacts). Рыба внутри — jewel-tone
   constructivist palette, чужой DS визуальный язык. Два голоса в одной
   обёртке. Fluid SVG (viewBox-only, без width/height) — обязательное
   следствие §3a (artefact не должен bleed past container).

6. **Fixed model = Claude Opus 4.7.** Единственная LLM. Использование
   frontier reasoning model для одной рыбы в день — видимая часть
   художественной заявки проекта, а не операционный артефакт.

---

## Module Map

### pipeline/

- **dsl/** [BUILT]
  - `schema.ts` — Zod schema, closed enums (PRIMITIVES, HEAD_PRIMITIVES, TAIL_PRIMITIVES, FIN_TILTS, COLORS, POSITIONS).
  - `validator.ts` — cross-field constraints (≤4 colors, tail.side≠body.orientation, eye-on-head iff head≠null).
  - `signature.ts` — структурная подпись DSL для signature-tracking.

- **renderer/** [BUILT]
  - `palette.ts` — jewel-tone hex map. 8 цветов, имена стабильны (red/blue/yellow/black/white/accent_*), хексы калиброваны под constructivist register.
  - `primitives.ts` — рендер body / head / tail (incl. concave arrow/fork) / fin (tilted) / eye / accents / bg block.
  - `renderer.ts` — композиция, fluid SVG output (viewBox-only).
  - `version.ts` — RENDERER_VERSION.

- **storage/** [BUILT]
  - `storage.ts` — writeFish/readFish/writeEmptyDay/readEmptyDay.
  - `paths.ts` — FISH_DIR resolution.
  - `antirepeat.ts` — getRecentWords(dir, limit) для Stage 1.

- **llm/** [BUILT]
  - `client.ts` — OpenRouter wrapper, prompt caching support, OPENROUTER_REASONING_SUPPORTED=false (Bedrock не пропускает).
  - `stage1.ts` — word draw + trope guard + anti-repeat на Stage 1.
  - `stage2.ts` — sealed poetic image, FORBIDDEN_PATTERNS на мета-объяснения.
  - `stage3.ts` — DSL translation, decision procedure, 5 few-shot exemplars, anti-ellipse semantic ceiling.

- **pipeline/** [BUILT]
  - `daily.ts` — runDaily() orchestrator, atomic write, empty-day fallback по стейджам.

- **publishing/** [BUILT]
  - `publishing.ts` — getCanonicalFish/getCanonicalEmptyDay для статической сборки.

- **delivery/** [BUILT]
  - `png.ts` — svgToPng(svg, width=800) через @resvg/resvg-js.
  - `telegram.ts` — postFishToTelegram + buildCaption (HTML-escaped).

- **scripts/** [BUILT]
  - `verify-openrouter.ts` — пробы caching/reasoning поведения.
  - `dry-run.ts` — полный pipeline в tmpdir, без записи в fish/.
  - `run-daily.ts` — продакшн-прогон, пишет в fish/.
  - `post-tg.ts` — постит существующую рыбу в TG; empty-day case → exit 0.

### web/

- **src/layouts/** [BUILT] — `Default.astro` (DS tokens, fish-figure styling, archive contact-sheet grid, metaAnchor prop).
- **src/components/** [BUILT] — `Topbar.astro` (v0.7 epigraph + active rows, mobile reflow), `Footer.astro`, `Fish.astro` (figure + FIG label), `ConceptCard.astro`.
- **src/pages/** [BUILT] — `index.astro` (today), `[date].astro` (permalink, getStaticPaths), `archive.astro` (contact sheet).
- **src/lib/** [BUILT] — `fish-loader.ts` (build-time чтение из fish/).
- **scripts/copy-ds.mjs** [BUILT] — prebuild копирует tokens.css + typography.css + 12 woff2 fonts из submodule в public/.

### .github/workflows/

- **daily-fish.yml** [BUILT] — cron 00:05 UTC, npm run daily → commit + push → post-tg → trigger deploy-web.
- **deploy-web.yml** [BUILT] — push в master по paths-фильтру → Astro build → GH Pages.

---

## Active Decisions

### D1. Three-stage pipeline architecture
Stage 1 (word, temp 1.0) → Stage 2 (poetic image, temp 0.9) → Stage 3 (DSL,
temp 0.3 + 4 retries с validator-feedback). Live в `pipeline/src/llm/stage{1,2,3}.ts`.
**Spec:** `docs/superpowers/specs/2026-04-25-rybov-design.md` § 4.2.

### D2. Closed-enum DSL with cross-field validator
Все ключи DSL имеют закрытый enum в zod schema. Validator проверяет три cross-field правила
(color cap, tail.side opposite, eye-on-head iff head). Single source of truth для рендера —
`pipeline/src/dsl/schema.ts`.

### D3. Fluid SVG output (viewBox-only)
Renderer возвращает SVG без `width`/`height` атрибутов, только `viewBox`. Размер
определяется CSS-консьюмером (web figure container, PNG converter target width).
Без этого DS §3a (artefact не должен bleed past container) невыполним.

### D4. Constructivist jewel-tone palette
8 цветов в закрытом enum, hex-значения калиброваны под deep purple/moss green/burgundy
register. Имена стабильны; хексы — переменная конкретного художественного периода.

### D5. Stage 2 «sealed poetic image» framing
Stage 2 prompt запрещает биологическое перечисление features, требует ОДНУ poetic
compression. Few-shot anchor: «Рыба, плывущая против течения собственных слёз.»
Гардрейлы блокируют мета-объяснения метафоры (символизирует/означает/etc),
но не сами similes.

### D6. Stage 3 anti-bias on ellipse
Decision procedure (нумерованный 6-step чек-лист) форсит обход 5 не-ellipse примитивов
до выбора ellipse. Motion verbs (плывёт, дрейфует) explicitly не лицензируют ellipse.
5 few-shot exemplars покрывают composite/rectangle/semicircle_with_triangle/triangle/semicircle.

### D7. Stage 1 anti-trope guard
Static blacklist в systemPrompt: saudade/komorebi/hygge/ikigai/etc. + cross-language
синонимы. Без этого guard'а Opus при temp 1.0 всё равно tendency к «untranslatable
foreign poetry» trope-collapse.

### D8. PNG raster at post-time, fluid-SVG-friendly
`svgToPng` использует `fitTo: { mode: 'width', value: 800 }` — независим от
intrinsic SVG dimensions. Возможен потому что SVG fluid (D3).

### D9. Atomic daily run with empty-day fallback per stage
Любой failure stage1/2/3/render/storage даёт empty-day marker `<date>.empty.json`
вместо partial state. Pipeline никогда не пишет half-completed рыбу.

### D10. No anti-repeat at Stage 3
Сознательный отказ. Stage 1 anti-repeat (по последним 30 словам в FISH_DIR) — есть
и работает в продакшне. Stage 3 anti-repeat (по примитивам) — запрещён, рушит
концепцию «один независимый генератор в день».

### D11. arkadiy-ds frames the artefact, не absorbs (DS §3a)
Page chrome — warm-coal + coral DS. Fish — jewel-tone constructivist. Frame =
hairline figure container, mono FIG. caption, нет surface-tinting под палитру
рыбы. Archive — контактный шит per §3a end-note.

### D12. Daily cron + Telegram + auto-trigger deploy
00:05 UTC ежедневный workflow: `npm run daily` → commit → push → post-tg → triggers
`deploy-web.yml` через `gh workflow run` (workflow_dispatch обходит анти-рекурсивную
защиту GITHUB_TOKEN).

---

## History of Architectural Decisions

Append-only лог. Ничего не удаляется, отменённые решения помечаются как `[deprecated]`.

### 2026-04-25 — Project conception, spec + plan landed
**Что:** Brainstorm закрыт, написана спека `docs/superpowers/specs/2026-04-25-rybov-design.md` и
implementation plan `docs/superpowers/plans/2026-04-25-rybov-implementation.md`.
**Почему:** Стартовая точка, фиксирует D1-D2 (3-stage pipeline, closed-enum DSL).

### 2026-04-25 — Phases 0-7.1 implemented
**Что:** DSL, renderer, storage, publishing, LLM stages 1-3, daily orchestrator
закрыты по чек-листу плана. Закоммичены за серию dedicated commits.
**Почему:** Базовый pipeline до точки «можно запускать end-to-end».

### 2026-04-25 — Smoke-driven creative tuning session
**Что:** Палитра сдвинута в jewel-tones (D4 фиксация). Stage 2 переписан под
«sealed poetic image» (D5). DSL расширен — добавлены head element, tail variants
(rectangle/arrow/fork), fin tilt enum. Stage 3 переписан с decision procedure +
anti-ellipse + 5 few-shot exemplars (D6). Stage 1 получил anti-trope guard (D7).
**Почему:** Первые smoke-runs показали ellipse-bias 60-100%, narrow palette
ощущалась простенько. Iterative tuning через 3-4 батча по 5 dry-runs снизил
ellipse-rate до ~20% и наполнил body diversity.

### 2026-04-25 — Phase 8 (Web) shipped with §3a deviations
**Что:** Astro workspace, Default layout с DS-токенами, fish loader, Today/Permalink/
Archive страницы. Две дельты против оригинальной спеки: figure sizing для fluid SVG
(D3) и archive как контактный шит (per §3a end-note).
**Почему:** DS v0.6 §3a была написана после Phase 8 спеки; deviations отражают
актуальные DS правила.
**Отчёт:** `docs/superpowers/plans/2026-04-25-rybov-implementation-phase-8-report.md`.

### 2026-04-25 — Phases 9-11 shipped (delivery, automation, README)
**Что:** SVG→PNG (D8), Telegram bot post, GH Actions workflows (D12), README.
**Почему:** Замыкание pipeline до полной автономии «один cron в день».
**Отчёт:** `docs/superpowers/plans/2026-04-25-rybov-implementation-phase-9-10-11-report.md`.

### 2026-04-25 — First real fish committed
**Что:** Коммит `45d26f1 fish: 2026-04-25` от rybov-bot. Первый production-прогон
end-to-end успешен — рыба, TG-пост, deploy.

### 2026-04-26 — arkadiy-ds v0.7 mobile-pass adopted
**Что:** Bump submodule до v0.7. Topbar.astro переписан под §8.2a (epigraph row на
mobile) + §8.3 (eyebrow slot), metaAnchor prop проброшен через layout. Mobile-
gutter токены применяются автоматически через media-query.
**Почему:** Mobile vertical топбар был визуально сломан — 3-колоночный grid не
влезал в narrow viewport. DS-side fix чище, чем локальный костыль в rybov.

---

## Open Questions

### OQ1. Доступность сайта из RU-сетей с DPI на GitHub Pages IP
Симптом: оператор не может открыть `https://hedgeinform.github.io/rybov/` или custom
domain `rybov-show.hedgeinform.ru` со своей сети, при этом из других точек RF
(check-host подтвердил Москва/Питер/Екб) сайт открывается. Локальная проблема его
ISP/DNS/firewall, не паттерн на всю аудиторию.
**Trigger для re-review:** если анекдоты от других RU-посетителей о недоступности
накопятся — рассматривать миграцию на Cloudflare Pages.

---

## Known Drift

Принятые отклонения от идеала. Не план на исправление (тогда было бы в
`docs/active-issues.md`), а сознательное «живём с этим».

### TD1. OG meta image points at .svg, ne sluzhitsya statikoy
`pipeline/src/publishing/publishing.ts:47` устанавливает `image: ${permalinkUrl}.svg`,
но статический сайт SVG по этому URL не сервит, и социальные платформы (TG/Twitter/FB)
не рендерят SVG OG-превью даже если бы файл был доступен.
**Триггер для починки:** когда возникнет реальная необходимость в социальных
превью. Фикс — три шага: (a) `publishing.ts` → `.png`, (b) генерировать PNG в
`daily.ts` рядом с SVG, (c) `web/scripts/copy-ds.mjs` копирует fish/*.png в
web/public/.

### TD2. CI без шага `npm run test:run`
`daily-fish.yml` и `deploy-web.yml` пропускают unit-тесты перед production-работой.
**Триггер для починки:** первая ситуация, когда нерабочий код прошёл в master и
сломал ежедневный прогон.

### TD3. Test fixtures pre-DSL-extension
Sample records в `tests/storage/storage.test.ts`, `tests/publishing/publishing.test.ts`,
`tests/storage/antirepeat.test.ts` используют DSL без `head`, без `fin.tilt`, и
signature без `head_primitive`/`tail_primitive`. Runtime OK (storage не валидирует),
TypeScript strict-check бы сломался.
**Триггер для починки:** первый storage-рефакторинг, который начнёт применять
типы строго.
