# Rybov — Design Specification

**Date:** 2026-04-25
**Status:** Approved (brainstorming complete; ready for implementation planning)
**Design owner:** project owner (architect/PM)
**Brainstormed with:** Claude Opus 4.7

---

## Background

В 2023 году владелец проекта пообещал тогдашней партнёрше «концептуальный рисунок рыбки» — мелкий геометрический набросок, выросший из его экспериментов с треугольниками в MS Paint. Обещание не было выполнено три года. К 2026 году, в эпоху доступных frontier-агентов, обещание было переосмыслено: вместо одиночного артефакта — продукт, который превращает идею «концептуальной рыбы» в ежедневный ритуал.

`Rybov` — результат этого переосмысления. Имя — латинская транслитерация русскоязычного интернет-мема «Рыбов показываем?» («— Красивое»), задающего тональность проекта: искреннее искусство в нарочито абсурдной упаковке. Транслитерация выбрана как нейтральный к языку бренд, который сохраняет мем как easter-egg для русскоязычной аудитории, не блокируя международное прочтение.

---

## Vision & Scope

### Что строим

`Rybov` — сервис, публикующий **одну концептуальную рыбу в сутки**. Рыба генерируется трёхстадийной цепочкой Claude Opus 4.7 и отрисовывается процедурным SVG-движком в конструктивистском стиле. У каждой рыбы — постоянный URL и ассоциированный концепт (слово, ассоциация, DSL-параметры). Доставка — два канала: каноничный веб-архив и Telegram-канал.

### Чем НЕ является

- **Не генератор по запросу.** Никакой кнопки «сгенерировать ещё одну».
- **Не персональный сервис.** Одна рыба в сутки — глобально, для всех. Один и тот же артефакт для всех зрителей.
- **Не социальная сеть.** Нет реакций, комментариев, лайков (по крайней мере, в MVP).
- **Не мульти-стилевой каталог.** Только конструктивистский стиль в MVP. Single-line как direction-кандидат на потом.

### Целевые свойства (rank-ordered)

1. **Концептуальная чистота.** Любое продуктовое решение подчинено идее «одна рыба, один день, навсегда». Фичи, размывающие это, отбрасываются.
2. **Художественная целостность.** Все рыбы должны быть узнаваемо «одной серии». Стилистическая дисперсия — низкая, концептуальная — высокая.
3. **Воспроизводимость и владение DNA.** У каждой рыбы — текстовый концепт + DSL-параметры — её исходник. Не black-box image-generation; код.
4. **Zero-friction просмотр.** Зашёл на URL — увидел рыбу. Никаких куков, JS-блоков, регистраций, аналитических попапов.

### Audience phasing

- **Phase 1 (MVP):** русскоязычная аудитория. Первая пользовательница — конкретный человек, для которого изначально замышлялся артефакт. Концепт-карточка и UI на русском.
- **Phase 2 (post-MVP, conditional):** международное прочтение, EN-локализация UI, возможные мультиязычные glosses. Бренд `Rybov` уже language-agnostic, переход не требует ребрендинга.

---

## Architecture

Три архитектурные зоны плюс единый промежуточный слой публикации.

```
                    [ Daily UTC Cron ]
                           ↓
         ── Generation Pipeline (1× per day) ──
                           ↓
              [ Concept Generator (3 Opus calls) ]
                           ↓
                  [ DSL Validator ]
                           ↓
              [ Procedural Renderer ]
                           ↓
         ──────────[ Storage (raw data) ]──────────
                           ↓
              [ Publishing Module (canonical form) ]
                           ↓
         ── Delivery Channels (always on) ──
              ↓                              ↓
       [ Web Renderer ]                [ TG Bot ]
              ↓                              ↓
              └────── Viewer ────────────────┘
```

### Pattern C: shared publishing layer

Web и TG **не сиблинги по storage**. Между storage и каналами доставки живёт `Publishing Module` — чистая функция `getCanonicalFish(date) → CanonicalFish`, которая формирует канонический URL, OG/social meta, alt-text, и весь channel-agnostic «product shape». Web и TG — оба consumer'ы этой формы.

Это даёт:
- Канонический URL формируется в **одном** месте.
- TG не зависит от web uptime: `Publishing Module` сам знает URL, не спрашивает web.
- Новые каналы (Twitter, RSS, Mastodon) добавляются как новые consumer'ы Publishing Module без правок в storage или web.

### Ключевые архитектурные решения

1. **Single source of truth = Storage.** Никаких дублирующих state'ов в TG, в браузере, в кэшах. Изменение в storage → atomically отражается во всех каналах.
2. **Storage = git-versioned файлы.** Не БД. Один файл на день. Audit trail из коробки, бесплатный бэкап, статичный хостинг. Не масштабируется на 100K записей — но 365/год нас туда никогда не приведут.
3. **Generation pipeline — sequential, не event-driven.** Один cron, одна функция, последовательно. Никаких очередей, воркеров, async-демонов.
4. **DSL Validator — обязательный gate между LLM и рендерером.** Без него гибридная генерация деградирует в LLM-roulette.
5. **Web — статический.** Static site generation на push в репозиторий. Нет runtime-зависимости от storage.

---

## Components

| Компонент | Роль | Логика |
|---|---|---|
| **Cron Scheduler** | Триггер раз в сутки в фиксированное UTC | Без логики, чистый триггер |
| **Concept Generator** | Три последовательных вызова Claude Opus 4.7 | См. секцию 4 |
| **DSL Validator** | Schema-strict валидация выхода Stage 3 | Чистая функция `dsl_params → ok \| error_with_feedback` |
| **Procedural Renderer** | DSL → SVG строка | Чистая функция, без I/O, детерминированная |
| **Storage** | Файловая система: JSON + SVG | `fish/YYYY-MM-DD.json` + `fish/YYYY-MM-DD.svg`, git-versioned |
| **Publishing Module** | Storage → CanonicalFish | Чистая функция, формирует canonical URL/OG/alt |
| **Web Renderer** | Static site generation | Страницы: `/`, `/YYYY-MM-DD`, `/archive` |
| **TG Bot** | Постит в Telegram-канал | Stateless, использует Publishing Module |

---

## Creative Core: DSL × Concept × Claude

Это сердце проекта. Большинство архитектурных решений в других секциях — производные от решений здесь.

### 4.1 DSL Design

**Уровень абстракции — mid-level.** LLM выбирает части и их свойства из закрытых перечислений; рендерер исполняет детерминированно.

**Слоты (≤ 7):**

| Слот | Required | Поля |
|---|---|---|
| `body` | yes | primitive, color, orientation |
| `eye` | yes | style, position, colors |
| `tail` | no | primitive, color, side |
| `fin_top` | no | primitive, color |
| `fin_bottom` | no | primitive, color |
| `background_block` | no | color, size, offset |
| `accents` (≤ 3) | no | type, color, position |

**Закрытые перечисления (no free-form values):**

- `primitive`: `triangle`, `ellipse`, `semicircle`, `rectangle`, `composite_two_triangles`, `semicircle_with_triangle`
- `color` (имя, не hex): `red`, `blue`, `yellow`, `black`, `white`, `accent_cyan`, `accent_ochre`, `accent_deep_red`
- `orientation`: `left` | `right`
- `position` (для eye/accents): фиксированный закрытый список ~8-12 категориальных значений (примеры: `front_top`, `front_center`, `front_low`, `midline`, `tail_side`, `low`, `head_top`, `head_bottom`). Точный список финализируется в renderer-коде в writing-plans вместе с реализацией позиционирования
- `size`: `small` | `medium` | `large`
- `offset`: пара значений из `{-30, -15, 0, 15, 30}` × `{-30, -15, 0, 15, 30}` — дискретная сетка

**Constraints в валидаторе:**

- Уникальных цветов в рыбе ≤ 4 (включая фон)
- `tail.side` и `body.orientation` обязаны быть противоположны (или `tail = null`). Т.е. рыба, плывущая вправо, имеет хвост слева; плывущая влево — справа
- `background_block.color` обязан быть из палитры
- `accents.length ≤ 3`

**Художественные правила в рендерере (не в DSL):**

- Жёсткие края: никаких gradient, blur, opacity (кроме `accents.opacity = subtle`)
- Все примитивы выравниваются по неявной сетке 10px
- ViewBox фиксированный 200×140
- Stroke widths: 2px для контуров, 2.5px для accent-линий
- Если `background_block` есть — рендерится первым с offset
- Если нет — фон `#FAFAFA`

**Принцип разделения:** «**что выбрать**» (DSL, LLM-территория) vs «**как нарисовать выбранное**» (рендерер). Это даёт центральный рычаг управления стилем (см. 4.4).

### 4.2 Concept Text & Three-Stage Generation

**Самое важное решение в проекте.** Concept text **не генерируется Opus'ом напрямую** с осознанием, что он создаёт art. Он эмерджентно возникает из трёхстадийной цепочки, где Opus на каждой стадии **не знает** мета-цели.

**Архитектурное свойство: dumb → smart → dumb.** Творческий момент — Stage 2 (ассоциация) — зажат между максимально-слепой Stage 1 (рандомное слово) и максимально-механической Stage 3 (трансляция в DSL). Интеллект сэндвичем.

#### Stages

**Stage 1 — Word draw.**
- *Input:* anti-repeat list (последние 30 слов из storage)
- *Task:* «Pick any word in any language. Avoid these: [...]. Return: { word, language, transliteration_if_non_latin, russian_meaning }»
- *Output:* 4 поля JSON
- *Temperature:* high (~1.0)
- *Allowed retries:* 2 (на структурную невалидность output'а)

**Stage 2 — Fish vision.**
- *Input:* output Stage 1
- *Task:* «Here is a word. Describe a fish that comes to mind. 1–3 sentences. No metaphor explanations, no symbolism unpacking, just the visual.»
- *Output:* строка-описание, ≤ 3 предложений
- *Temperature:* high (~0.9). Творческий момент.
- *Guardrails:* запрещённые паттерны (`symbolizes`, `represents`, `means`, `because`, и их русские эквиваленты) детектятся → retry с ужесточённым промптом
- *Allowed retries:* 2

**Stage 3 — Form translation.**
- *Input:* output Stage 2 + DSL-схема в системном промпте
- *Task:* «Here is a fish description. Translate into DSL parameters. Use only enum values from the schema. Return structured JSON.»
- *Output:* DSL params JSON
- *Temperature:* low (~0.3). Деталинизация, не творчество.
- *Allowed retries:* 4 (с feedback'ом валидатора на каждом ретрае)

#### Why Opus, not Sonnet

Концептуальное решение, не техническое. Sonnet справился бы технически. Художественная заявка проекта — **абсурдность использования frontier reasoning model для одной рыбы в день**. Это видимая в коде архитектурная декларация: «это сделано Opus'ом, и это часть смысла». Стоимость: ~$0.04/день, ~$15/год — operationally negligible.

#### API access path

В MVP — через **OpenRouter** (модель `anthropic/claude-opus-4.7`) как временный gateway, поскольку прямого Anthropic API key на момент старта нет. Архитектурно: API-клиент инкапсулирован в одном модуле; переключение на нативный Anthropic SDK позже = замена одного файла без ripples в остальной кодовой базе.

**Reasoning effort: target max, fallback default.** Цель — максимальный reasoning effort (через `reasoning.effort` или эквивалентный параметр). Но передача этого параметра через OpenRouter для Anthropic моделей **не гарантирована** — должно верифицироваться в первой итерации writing-plans на hello-world вызове. Если OpenRouter не пробрасывает effort-параметр — fallback на default reasoning. Это не блокер: качество концепт-арта не должно критически зависеть от уровня reasoning effort, и если зависит — это сигнал к более тонкой настройке промптов, не к смене модели.

#### User-facing concept format (Variant b: museum card)

Пользователь видит **всю цепочку**, не только рыбу:

```
СЛОВО ДНЯ
मानसून (хинди: монсун — сезон дождей)

РЫБА
Рыба, плывущая против течения собственных слёз

DSL
body: ellipse / blue / left
tail: triangle / blue / right
eye: double_circle / front_low
background_block: yellow / large / [-15, -15]
```

DSL отображается как **компактная human-readable summary**, не как сырой JSON. Точный формат вёрстки — на этапе writing-plans (приоритет: читаемость зрителем без знания DSL-схемы, при сохранении однозначной обратимости в исходный JSON).

**Процесс — главный экспонат.** Рыба — артефакт процесса. Кейс-история — не «вот красивая рыба», а «вот как Opus сделал красивую рыбу, не зная, что делает её».

#### Atomicity

Одна cron-итерация = один процесс = три последовательных вызова в одной транзакции. Никаких persisted intermediate states между запусками. Если падает любая стадия после исчерпания ретраев — день не публикуется.

#### Prompt caching

Системные промпты каждой стадии — стабильны, кэшируются (`cache_control: ephemeral` при работе через нативный Anthropic SDK). Покрывает ~80% input-токенов. Не критично экономически (объём малый), но правильная гигиена.

**Caveat для OpenRouter MVP:** OpenRouter исторически не всегда пробрасывает Anthropic prompt caching директивы. Если в MVP кэшинг не работает через OpenRouter — отключаем, экономика всё равно остаётся в пределах ~$15-30/год. После миграции на нативный API — включается обратно одной правкой в API-клиенте.

### 4.3 Anti-Repeat Discipline

**Word-level anti-repeat (Stage 1) — обязателен.**
- Окно: 30 последних слов
- Без него цепочка коллапсирует в LLM-defaults (`serendipity, ephemeral, harmony, liminal, ...`)
- Минимальная утечка контекста: Opus узнаёт, что слова — серия, но не узнаёт, что за серия
- Через год повторы возможны и приемлемы как lore-feature

**DSL-level anti-repeat (Stage 3) — НЕ делаем.**
- Если Opus, получив слово и описание, выходит на похожую рыбу — это **его голос**, не баг
- Цензурирование противоречит главной предпосылке (Opus как единственный творческий субъект)
- Принцип: failure должен означать «сломалось операционно», не «Opus сделал то, что нам не понравилось»

**Однако сигнатуры считаем и пишем в storage** — как observability metadata.
- Сигнатура (5 полей): `body_primitive`, `body_color`, `has_bg_block`, `bg_color`, `has_tail`
- Не gate, только наблюдение
- Если когда-нибудь увидим патологическое схождение (например, топ-3 силуэта покрывают >70% архива) — реакция **структурная**: расширить DSL, не цензурить Opus
- Алерт в условную админку — parking lot, не MVP

### 4.4 Art Direction & Renderer Evolution

**Two-place locus of style:**

| Слой | Что определяет | Кто решает |
|---|---|---|
| DSL | Что можно выбрать | Opus, на уровне «какая рыба сегодня» |
| Renderer | Как выбранное выглядит | Developer, на уровне «как выглядит вся серия» |

**DSL = identity, Renderer = presentation.** Аналогия: DSL — виниловая запись (фиксированная), Renderer — звуковая система (заменяемая).

**Эволюционные правила:**

- **DSL эволюционирует только аддитивно.** Новые primitive'ы, новые цвета, новые слоты — можно. Удаление существующего enum value сделает архивные DSL'ы невалидными — нельзя.
- **Renderer изменения — ретроактивны (System A).** Поменял hex красного → весь архив перерендерился в новом красном. Это фича для рефайна.

**System A vs System B:**

В MVP — **System A**: один renderer alive, изменения retroактивны всегда. Просто, мало кода.

**Но `renderer_version` и `model_version` пишутся в storage с самого начала.** Это **дешёвая страховка для будущего**. Если когда-нибудь захочется System B (per-fish renderer pinning, dispatcher, immutable archive по версиям) — миграция возможна без археологии. До тех пор — стампы informational only.

**Renderer v1.0.0 anchors (стартовый стиль):**

- ViewBox: `200×140`
- Палитра:
  - `red` → `#D32F2F`
  - `blue` → `#1E5BCC`
  - `yellow` → `#F5C518`
  - `black` → `#111111`
  - `white` → `#FAFAFA`
  - 3 accent: `accent_cyan #2A9DC9`, `accent_ochre #B8862E`, `accent_deep_red #8A1F1F`
- Stroke widths: `2px` контуры, `2.5px` accent-линии
- Eye default: `double_circle` (white outer `#FAFAFA` + black inner `#111`), радиусы ~9px / ~3.5px
- Background fill (когда нет `bg_block`): `#FAFAFA`
- Implicit grid: 10px

---

## Daily Lifecycle

```
00:00 UTC  →  Cron триггерит process
            │
            ├─ load anti-repeat: read last 30 words from storage
            │
            ├─ Stage 1 (Opus): word draw
            │   ├─ on structural fail: retry × 2
            │   └─ on persistent fail: → DAY FAIL
            │
            ├─ Stage 2 (Opus): fish vision
            │   ├─ on structural / no-explanation guardrail fail: retry × 2
            │   └─ on persistent fail: → DAY FAIL
            │
            ├─ Stage 3 (Opus): DSL translation
            │   ├─ on DSL Validator fail: retry × 4 with feedback
            │   └─ on persistent fail: → DAY FAIL
            │
            ├─ compute signature (observability)
            │
            ├─ Procedural Renderer: DSL → SVG string
            │
            ├─ Storage write:
            │   ├─ fish/YYYY-MM-DD.json (concept chain + DSL + signature + renderer_version + model_version)
            │   └─ fish/YYYY-MM-DD.svg
            │
            ├─ Git commit + push
            │
            ├─ Web rebuild (CI на push)
            │
            └─ TG Bot:
                ├─ Publishing Module: getCanonicalFish('today')
                ├─ format TG message: image preview + concept stages + permalink
                └─ post to channel

DAY FAIL  →  alert operator + write fish/YYYY-MM-DD.empty.json (с причиной)
            + страница дня показывает «Сегодня без рыбы»
```

**Свойства pipeline'а:**

- **Atomic.** До storage write ничего не зафиксировано вне процесса
- **TG не блокирует canonical state.** Если storage прошёл, TG упал — рыба опубликована (web canonical), TG retry'ится отдельно
- **Empty-day = first-class artifact.** В архиве — валидная запись с причиной. Не тихий fallback, не подмена предыдущим днём (соответствует глобальному принципу №5: fallback-на-дефолт молча запрещён)

---

## Testing Approach

| Что тестируем | Метод |
|---|---|
| Procedural Renderer | Unit + golden-set: фикстуры `(dsl, expected_svg_hash)`. Чистая функция → детерминизм → воспроизводимый хэш |
| DSL Validator | Unit: валидные конфиги pass, невалидные fail с осмысленным сообщением. Покрытие enum'ов, обязательных полей, кросс-полевых constraint'ов |
| Publishing Module | Unit: `getCanonicalFish(date)` → правильный canonical URL, OG-meta shape, alt text |
| Stage 1/2/3 prompts (Opus) | **Не unit-тестируется.** Dry-run mode для всего pipeline'а (skip git/TG, generate locally). Запускаешь N раз, eyeball'ишь результаты |
| TG Bot | Интеграционный тест против test-канала с test-bot'ом. Single happy-path |
| End-to-end | Один CI-test: dry-run pipeline + assert на shape всех артефактов (json structure, svg validity) |

**Сознательно НЕ автоматизируем:** quality eval Opus-output'ов. Это не решается инструментально — качество концепт-арта оценивается глазами. Принимаем как часть стоимости.

---

## MVP Scope

### In MVP

- Generation pipeline (3-stage Opus chain, structured outputs, anti-repeat words)
- Constructivist DSL (≤ 7 slots, закрытые enum'ы, validator)
- Procedural Renderer v1.0.0 (фиксированная палитра, viewbox, штрих)
- File-based storage (git-versioned JSON + SVG)
- Publishing Module (canonical URL, OG meta)
- Web Renderer (today / permalinks / archive)
- TG Bot (daily post в канал)
- Cron scheduler
- `renderer_version` + `model_version` стампы (informational)
- Concept text format (b): word + association + DSL — все три на странице
- Concept text language: **русский** (gloss слова + описание рыбы)

### Parking lot (осознанно НЕ делаем сейчас)

- **Style B (single-line)** — secondary direction, оставлен на «когда A заработает чисто»
- **Styles C/D (sumi-e, mid-century)** — out of project scope
- **DSL signature monitoring → admin dashboard** — observability в storage есть, UI позже
- **Renderer dispatcher (System B)** — стампы готовы, dispatcher добавляется когда первый раз понадобится форкнуть стиль
- **Personal daily fish** — после альфы, если будет сигнал
- **Reactions, comments, likes** — нет в концепции «один день, одна рыба, тишина»
- **User accounts / auth**
- **Дополнительные каналы доставки** (Twitter, RSS, Mastodon)
- **Generation on demand**
- **Custom domain `rybov.show`** — пока path под `hedgeinform.tld`
- **EN-локализация UI и multilingual glosses** — Phase 2

---

## Open Items for Implementation Planning

К решению на этапе writing-plans:

- **Web stack:** Astro / Next.js export / Eleventy / самописный шаблонизатор
- **Hosting:** зависит от выбора стека (статика → Cloudflare Pages / Netlify / GitHub Pages / hedgeinform-сервер)
- **Cron mechanism:** GitHub Actions schedule / VPS cron / serverless scheduler
- **TG Bot framework:** python-telegram-bot / aiogram / grammy / minimal HTTP-bot
- **DSL Validator implementation:** JSON Schema / Zod / Pydantic / самописная
- **Drop time:** дефолт `00:00 UTC`, обсуждаемо
- **CI/CD:** конкретный pipeline (предположительно GitHub Actions)
- **Repo path под hedgeinform:** конкретный URL-prefix для web
- **API gateway verification (hello-world задача в первой итерации writing-plans):** OpenRouter в MVP, модель `anthropic/claude-opus-4.7`. Проверить: (1) пробрасывается ли `reasoning.effort` для Anthropic моделей; (2) работают ли Anthropic prompt caching директивы. По результатам — настроить API-клиент.
- **Secret storage:** `OPENROUTER_API_KEY` (MVP) → `ANTHROPIC_API_KEY` (после миграции на нативный SDK), `TELEGRAM_BOT_TOKEN`. Все — env vars, конкретный механизм инъекции зависит от выбранного хостинга cron'а. Под проект создаётся отдельный API key, не переиспользуется.

---

## Appendix: Глобальные принципы — соответствие

(reference: `~/.claude/CLAUDE.md` § «Архитектурные принципы»)

| Принцип | Соответствие |
|---|---|
| 1. God Object запрещён | Components разбиты по single responsibility; ни один компонент не несёт >1 роли |
| 2. Выбор между кодом и LLM по задаче | Stage 1/2 — LLM (генерация смыслов); Stage 3 — LLM-translation в structured output (промежуточный); Renderer — pure code; Validator — pure code |
| 3. Секреты в credential store | `OPENROUTER_API_KEY` (MVP) → `ANTHROPIC_API_KEY` (после миграции), `TELEGRAM_BOT_TOKEN` — env-vars, не в коде. Отдельный API key создаётся под этот проект |
| 4. Single source of truth | Storage — единственный канонический источник состояния |
| 5. Fallback-на-дефолт молча запрещён | Empty-day = explicit `.empty.json` с причиной; не тихий fallback на previous day |
| 6. Never delegate understanding | Архитектурные решения зафиксированы с rationale |
| 7. User-facing response приоритетнее побочных эффектов | TG-fail не блокирует canonical web publish |
| 8. Фиксация решений в момент принятия | Этот документ |
| 9. Read current state, not target state | Web/TG читают через Publishing Module из текущего storage; не кэшируют |
| 10. Sequential implementation по dependency graph | Implementation plan будет следовать порядку: Validator → Renderer → Storage → Generator → Publishing → Web → TG → Cron |
