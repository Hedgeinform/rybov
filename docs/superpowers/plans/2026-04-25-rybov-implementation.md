# Rybov Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily concept-art fish service: a 3-stage Claude Opus 4.7 chain (via OpenRouter) generates a concept; a procedural SVG renderer renders it; a static Astro site (chrome from `arkadiy-ds`) and a Telegram bot publish it.

**Architecture:** Generation Pipeline (cron) → Storage (file-based, git) → Publishing Module (canonical fish) → Delivery Channels (Astro web + TG bot). Pure-code components (DSL validator, renderer, publishing) are tested deterministically; LLM stages are exercised via dry-run + eyeball review.

**Tech Stack:** TypeScript (Node 22+ ESM), Zod (DSL validation), Vitest (tests), `@resvg/resvg-js` (SVG→PNG for TG), Astro (static web), GitHub Actions (cron + deploy), GitHub Pages (default hosting). Single repo, npm workspaces (`pipeline/` + `web/`). Design system as git submodule (`design-system/arkadiy-ds`).

**Spec:** `docs/superpowers/specs/2026-04-25-rybov-design.md`

---

## Repository Layout (target end-state)

```
rybov/
├── package.json                       # workspace root
├── tsconfig.base.json                 # shared TS config
├── .gitignore .gitmodules .env.example README.md
├── .github/workflows/
│   ├── daily-fish.yml                 # cron: generate fish + commit + post TG
│   └── deploy-web.yml                 # build + deploy Astro on push
├── design-system/                     # submodule
├── docs/
├── fish/                              # storage (committed)
│   ├── 2026-04-25.json + .svg
│   └── 2026-04-26.empty.json (when DAY FAIL)
├── pipeline/
│   ├── package.json tsconfig.json vitest.config.ts
│   ├── src/
│   │   ├── dsl/             schema.ts validator.ts signature.ts
│   │   ├── renderer/        palette.ts primitives.ts renderer.ts version.ts
│   │   ├── storage/         paths.ts storage.ts antirepeat.ts
│   │   ├── llm/             client.ts stage1.ts stage2.ts stage3.ts
│   │   ├── publishing/      publishing.ts
│   │   ├── pipeline/        daily.ts
│   │   ├── delivery/        png.ts telegram.ts
│   │   ├── shared/          types.ts dates.ts
│   │   └── scripts/         verify-openrouter.ts run-daily.ts dry-run.ts
│   └── tests/
│       ├── dsl/ renderer/ storage/ publishing/
└── web/
    ├── package.json astro.config.mjs tsconfig.json
    └── src/
        ├── pages/    index.astro [date].astro archive.astro
        ├── layouts/  Default.astro
        ├── components/  Fish.astro ConceptCard.astro Topbar.astro Footer.astro
        └── lib/      fish-loader.ts
```

---

## Conventions used in this plan

- **Commit-after-each-task** unless a task explicitly bundles steps
- **TDD where applicable** (pure functions: test first; LLM/IO: smoke test after)
- **Commit messages** follow Conventional Commits: `feat:`, `test:`, `chore:`, `docs:`, `fix:`
- **Do NOT skip git hooks.** All commits include the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer
- **All test commands** run from the workspace they target unless noted: `npm --workspace pipeline test`

---

## Phase 0 — Setup

### Task 0.1: Initialize npm workspaces and root config

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Modify: `.gitignore` (add workspace artifacts)

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "rybov",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "workspaces": ["pipeline", "web"],
  "scripts": {
    "test": "npm --workspace pipeline test",
    "test:run": "npm --workspace pipeline run test:run",
    "build:web": "npm --workspace web run build",
    "dev:web": "npm --workspace web run dev",
    "verify:openrouter": "npm --workspace pipeline run verify:openrouter",
    "dry-run": "npm --workspace pipeline run dry-run",
    "daily": "npm --workspace pipeline run daily"
  }
}
```

- [ ] **Step 2: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ES2023"]
  }
}
```

- [ ] **Step 3: Append to `.gitignore`**

```
# Node / npm
node_modules/
*.log
.npm/

# TypeScript
*.tsbuildinfo
dist/

# Vitest cache
.vitest/

# Astro
.astro/
web/dist/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.base.json .gitignore
git commit -m "$(cat <<'EOF'
chore: initialize npm workspaces and shared TS config

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.2: Initialize `pipeline` workspace

**Files:**
- Create: `pipeline/package.json`
- Create: `pipeline/tsconfig.json`
- Create: `pipeline/vitest.config.ts`
- Create: `pipeline/src/.gitkeep`
- Create: `pipeline/tests/.gitkeep`

- [ ] **Step 1: Write `pipeline/package.json`**

```json
{
  "name": "@rybov/pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "verify:openrouter": "node --env-file=../.env src/scripts/verify-openrouter.ts",
    "dry-run": "node --env-file=../.env src/scripts/dry-run.ts",
    "daily": "node --env-file=../.env src/scripts/run-daily.ts"
  },
  "dependencies": {
    "zod": "^3.23.0",
    "@resvg/resvg-js": "^2.6.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  }
}
```

Node 22+ runs TS directly via `--experimental-strip-types` (default in 22.6+) or via `tsx`. We rely on Node's native TS stripping. If older Node is used, swap `node` → `tsx` in scripts.

- [ ] **Step 2: Write `pipeline/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `pipeline/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create empty placeholders so dirs commit**

```bash
mkdir -p pipeline/src pipeline/tests
touch pipeline/src/.gitkeep pipeline/tests/.gitkeep
```

- [ ] **Step 5: Install deps and verify**

```bash
npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 6: Commit**

```bash
git add pipeline/ package-lock.json
git commit -m "$(cat <<'EOF'
chore: scaffold pipeline workspace (TS strict, Vitest, Zod, resvg)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.3: First passing test (sanity)

**Files:**
- Create: `pipeline/src/shared/types.ts`
- Create: `pipeline/tests/sanity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/sanity.test.ts
import { describe, expect, it } from 'vitest';
import { RYBOV_VERSION } from '../src/shared/types.ts';

describe('sanity', () => {
  it('exports a version constant', () => {
    expect(RYBOV_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm --workspace pipeline run test:run
```

Expected: 1 fail (`Cannot find module '../src/shared/types'` or undefined export).

- [ ] **Step 3: Implement minimum to pass**

```ts
// pipeline/src/shared/types.ts
export const RYBOV_VERSION = '0.1.0';
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm --workspace pipeline run test:run
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/shared/types.ts pipeline/tests/sanity.test.ts
git commit -m "$(cat <<'EOF'
test: add sanity test verifying TS + Vitest plumbing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.4: Add `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write `.env.example`**

```
# OpenRouter (MVP gateway). Migrate to ANTHROPIC_API_KEY when direct key obtained.
OPENROUTER_API_KEY=sk-or-...

# Telegram bot — created via @BotFather; channel ID via @userinfobot or rawdata
TELEGRAM_BOT_TOKEN=123456:AAA-...
TELEGRAM_CHANNEL_ID=@rybov_show
```

`.env` itself is gitignored (already in `.gitignore` from initial commit).

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
chore: add .env.example with required secrets template

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — API Gateway Verification

This phase runs ONCE before all LLM-dependent code. Findings determine whether `reasoning.effort` and `cache_control` are usable through OpenRouter; the API client wrapper (Task 6.1) reads these as feature flags.

### Task 1.1: OpenRouter hello-world script

**Files:**
- Create: `pipeline/src/scripts/verify-openrouter.ts`
- Create: `docs/notes/openrouter-verification.md`

- [ ] **Step 1: Write the script**

```ts
// pipeline/src/scripts/verify-openrouter.ts
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-opus-4.7';

interface Probe {
  name: string;
  body: Record<string, unknown>;
}

const probes: Probe[] = [
  {
    name: 'baseline',
    body: {
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with the single word: PONG.' }],
      max_tokens: 20,
    },
  },
  {
    name: 'reasoning_effort_high',
    body: {
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with the single word: PONG.' }],
      max_tokens: 20,
      reasoning: { effort: 'high' },
    },
  },
  {
    name: 'cache_control_ephemeral',
    body: {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are PONG-bot. Always reply with the single word: PONG.',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
        { role: 'user', content: 'Hi.' },
      ],
      max_tokens: 20,
    },
  },
];

async function run(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  for (const probe of probes) {
    process.stdout.write(`\n=== probe: ${probe.name} ===\n`);
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Hedgeinform/rybov',
        'X-Title': 'Rybov verification',
      },
      body: JSON.stringify(probe.body),
    });
    const text = await res.text();
    process.stdout.write(`status: ${res.status}\n`);
    process.stdout.write(`body: ${text}\n`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script with a real key**

Manual setup before running:
1. Create OpenRouter account (https://openrouter.ai), generate API key
2. Copy `.env.example` → `.env` and fill `OPENROUTER_API_KEY`

```bash
npm run verify:openrouter
```

Expected: three blocks of output, each showing the API response.

- [ ] **Step 3: Document the findings**

Create `docs/notes/openrouter-verification.md`. Record what you observed for each probe:

```markdown
# OpenRouter Verification — Findings

**Date run:** YYYY-MM-DD
**Model:** `anthropic/claude-opus-4.7`

## Probe 1: baseline
- Status: 200 ✓ / fail
- Response: PONG / other
- Verdict: model + auth + base API surface OK

## Probe 2: reasoning_effort_high
- Status: ...
- Response includes `reasoning_details` field? YES / NO
- Token usage shows reasoning tokens? YES / NO
- Verdict: `OPENROUTER_REASONING_SUPPORTED = true | false`

## Probe 3: cache_control_ephemeral
- Status: ...
- Response usage shows `prompt_tokens_details.cached_tokens` (or analogous)? YES / NO
- Run probe 2× to test cache hit on second call
- Verdict: `OPENROUTER_CACHING_SUPPORTED = true | false`

## Decisions for client implementation (Task 6.1)

Based on the above:
- Reasoning effort: pass / omit
- Cache control: pass / omit
```

- [ ] **Step 4: Commit script + findings**

```bash
git add pipeline/src/scripts/verify-openrouter.ts docs/notes/openrouter-verification.md
git commit -m "$(cat <<'EOF'
feat: add OpenRouter verification script and findings doc

Verifies (1) baseline auth + model availability, (2) reasoning.effort
pass-through, (3) cache_control pass-through. Findings drive client
implementation in Task 6.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — DSL

### Task 2.1: DSL schema (Zod)

**Files:**
- Create: `pipeline/src/dsl/schema.ts`
- Create: `pipeline/tests/dsl/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/dsl/schema.test.ts
import { describe, expect, it } from 'vitest';
import { DSLSchema, COLORS, PRIMITIVES, POSITIONS } from '../../src/dsl/schema.ts';

describe('DSL schema enums', () => {
  it('exposes the closed color set', () => {
    expect(COLORS).toEqual([
      'red', 'blue', 'yellow', 'black', 'white',
      'accent_cyan', 'accent_ochre', 'accent_deep_red',
    ]);
  });
  it('exposes the closed primitive set', () => {
    expect(PRIMITIVES).toContain('triangle');
    expect(PRIMITIVES).toContain('composite_two_triangles');
  });
  it('exposes the closed position set', () => {
    expect(POSITIONS).toContain('front_top');
    expect(POSITIONS).toContain('midline');
  });
});

describe('DSLSchema parse', () => {
  it('accepts a minimal valid DSL', () => {
    const dsl = {
      body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
      eye: { style: 'double_circle', position: 'front_top' },
      tail: null,
      fin_top: null,
      fin_bottom: null,
      background_block: null,
      accents: [],
    };
    expect(DSLSchema.parse(dsl)).toEqual(dsl);
  });

  it('rejects an invalid color', () => {
    expect(() => DSLSchema.parse({
      body: { primitive: 'ellipse', orientation: 'right', color: 'turquoise' },
      eye: { style: 'double_circle', position: 'front_top' },
      tail: null, fin_top: null, fin_bottom: null,
      background_block: null, accents: [],
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm --workspace pipeline run test:run -- tests/dsl/schema.test.ts
```

- [ ] **Step 3: Implement the schema**

```ts
// pipeline/src/dsl/schema.ts
import { z } from 'zod';

export const COLORS = [
  'red', 'blue', 'yellow', 'black', 'white',
  'accent_cyan', 'accent_ochre', 'accent_deep_red',
] as const;
export const ColorSchema = z.enum(COLORS);
export type Color = z.infer<typeof ColorSchema>;

export const PRIMITIVES = [
  'triangle', 'ellipse', 'semicircle', 'rectangle',
  'composite_two_triangles', 'semicircle_with_triangle',
] as const;
export const PrimitiveSchema = z.enum(PRIMITIVES);
export type Primitive = z.infer<typeof PrimitiveSchema>;

export const ORIENTATIONS = ['left', 'right'] as const;
export const OrientationSchema = z.enum(ORIENTATIONS);

export const POSITIONS = [
  'front_top', 'front_center', 'front_low',
  'midline', 'low',
  'tail_side', 'head_top', 'head_bottom',
] as const;
export const PositionSchema = z.enum(POSITIONS);

export const SIZES = ['small', 'medium', 'large'] as const;
export const SizeSchema = z.enum(SIZES);

export const OFFSET_VALUES = [-30, -15, 0, 15, 30] as const;
export const OffsetSchema = z.tuple([
  z.union([z.literal(-30), z.literal(-15), z.literal(0), z.literal(15), z.literal(30)]),
  z.union([z.literal(-30), z.literal(-15), z.literal(0), z.literal(15), z.literal(30)]),
]);

export const EYE_STYLES = ['double_circle', 'dot', 'circle', 'square'] as const;
export const EyeStyleSchema = z.enum(EYE_STYLES);

export const ACCENT_TYPES = [
  'horizontal_line', 'horizontal_band', 'dot', 'small_triangle', 'small_square',
] as const;
export const AccentTypeSchema = z.enum(ACCENT_TYPES);

export const BodySchema = z.object({
  primitive: PrimitiveSchema,
  orientation: OrientationSchema,
  color: ColorSchema,
});

export const EyeSchema = z.object({
  style: EyeStyleSchema,
  position: PositionSchema,
});

export const TailSchema = z.object({
  primitive: PrimitiveSchema,
  color: ColorSchema,
  side: OrientationSchema,
}).nullable();

export const FinSchema = z.object({
  primitive: PrimitiveSchema,
  color: ColorSchema,
}).nullable();

export const BackgroundBlockSchema = z.object({
  color: ColorSchema,
  size: SizeSchema,
  offset: OffsetSchema,
}).nullable();

export const AccentSchema = z.object({
  type: AccentTypeSchema,
  color: ColorSchema,
  position: PositionSchema,
});

export const DSLSchema = z.object({
  body: BodySchema,
  eye: EyeSchema,
  tail: TailSchema,
  fin_top: FinSchema,
  fin_bottom: FinSchema,
  background_block: BackgroundBlockSchema,
  accents: z.array(AccentSchema).max(3),
});

export type DSL = z.infer<typeof DSLSchema>;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm --workspace pipeline run test:run -- tests/dsl/schema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/dsl/schema.ts pipeline/tests/dsl/schema.test.ts
git commit -m "$(cat <<'EOF'
feat(dsl): zod schema with closed enums for color/primitive/position

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: DSL validator with custom constraints

**Files:**
- Create: `pipeline/src/dsl/validator.ts`
- Create: `pipeline/tests/dsl/validator.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// pipeline/tests/dsl/validator.test.ts
import { describe, expect, it } from 'vitest';
import { validate } from '../../src/dsl/validator.ts';
import type { DSL } from '../../src/dsl/schema.ts';

const baseFish: DSL = {
  body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
  eye: { style: 'double_circle', position: 'front_top' },
  tail: { primitive: 'triangle', color: 'red', side: 'left' },
  fin_top: null, fin_bottom: null,
  background_block: null,
  accents: [],
};

describe('validate', () => {
  it('returns ok for a valid fish', () => {
    expect(validate(baseFish).ok).toBe(true);
  });

  it('rejects > 4 distinct colors', () => {
    const fish: DSL = {
      ...baseFish,
      fin_top: { primitive: 'triangle', color: 'yellow' },
      fin_bottom: { primitive: 'triangle', color: 'accent_cyan' },
      background_block: { color: 'accent_ochre', size: 'large', offset: [0, 0] },
    };
    const r = validate(fish);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/distinct colors/i);
  });

  it('rejects tail.side same as body.orientation', () => {
    const fish: DSL = {
      ...baseFish,
      tail: { primitive: 'triangle', color: 'red', side: 'right' },
    };
    const r = validate(fish);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tail.+opposite/i);
  });

  it('accepts tail = null regardless of orientation', () => {
    expect(validate({ ...baseFish, tail: null }).ok).toBe(true);
  });

  it('rejects background_block with non-palette color (handled by zod up-stream)', () => {
    // schema-level check; this asserts validator does not weaken it
    expect(() => validate({
      ...baseFish,
      // @ts-expect-error invalid color
      background_block: { color: 'fuchsia', size: 'small', offset: [0, 0] },
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm --workspace pipeline run test:run -- tests/dsl/validator.test.ts
```

- [ ] **Step 3: Implement the validator**

```ts
// pipeline/src/dsl/validator.ts
import { DSLSchema, type DSL, type Color } from './schema.ts';

export type ValidationResult =
  | { ok: true; dsl: DSL }
  | { ok: false; error: string };

export function validate(input: unknown): ValidationResult {
  const parsed = DSLSchema.parse(input); // throws on schema-level errors

  // Constraint 1: distinct colors ≤ 4
  const colors = new Set<Color>();
  colors.add(parsed.body.color);
  if (parsed.tail) colors.add(parsed.tail.color);
  if (parsed.fin_top) colors.add(parsed.fin_top.color);
  if (parsed.fin_bottom) colors.add(parsed.fin_bottom.color);
  if (parsed.background_block) colors.add(parsed.background_block.color);
  for (const a of parsed.accents) colors.add(a.color);
  if (colors.size > 4) {
    return { ok: false, error: `Too many distinct colors (${colors.size}); max 4 allowed` };
  }

  // Constraint 2: tail.side opposite to body.orientation
  if (parsed.tail && parsed.tail.side === parsed.body.orientation) {
    return {
      ok: false,
      error: `tail.side must be opposite to body.orientation (body=${parsed.body.orientation}, tail.side=${parsed.tail.side})`,
    };
  }

  return { ok: true, dsl: parsed };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm --workspace pipeline run test:run -- tests/dsl/validator.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/dsl/validator.ts pipeline/tests/dsl/validator.test.ts
git commit -m "$(cat <<'EOF'
feat(dsl): validator with cross-field constraints (color count, tail.side)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Signature computation

**Files:**
- Create: `pipeline/src/dsl/signature.ts`
- Create: `pipeline/tests/dsl/signature.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/dsl/signature.test.ts
import { describe, expect, it } from 'vitest';
import { computeSignature } from '../../src/dsl/signature.ts';
import type { DSL } from '../../src/dsl/schema.ts';

const fish: DSL = {
  body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
  eye: { style: 'double_circle', position: 'front_top' },
  tail: { primitive: 'triangle', color: 'red', side: 'left' },
  fin_top: null, fin_bottom: null,
  background_block: { color: 'yellow', size: 'large', offset: [-15, -15] },
  accents: [],
};

describe('computeSignature', () => {
  it('returns a 5-field structural fingerprint', () => {
    const sig = computeSignature(fish);
    expect(sig).toEqual({
      body_primitive: 'ellipse',
      body_color: 'blue',
      has_bg_block: true,
      bg_color: 'yellow',
      has_tail: true,
    });
  });

  it('omits bg_color when no bg block', () => {
    const sig = computeSignature({ ...fish, background_block: null });
    expect(sig.has_bg_block).toBe(false);
    expect(sig.bg_color).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// pipeline/src/dsl/signature.ts
import type { DSL, Primitive, Color } from './schema.ts';

export interface Signature {
  body_primitive: Primitive;
  body_color: Color;
  has_bg_block: boolean;
  bg_color: Color | null;
  has_tail: boolean;
}

export function computeSignature(dsl: DSL): Signature {
  return {
    body_primitive: dsl.body.primitive,
    body_color: dsl.body.color,
    has_bg_block: dsl.background_block !== null,
    bg_color: dsl.background_block?.color ?? null,
    has_tail: dsl.tail !== null,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/dsl/signature.ts pipeline/tests/dsl/signature.test.ts
git commit -m "$(cat <<'EOF'
feat(dsl): structural signature for observability

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Renderer

### Task 3.1: Palette + version constants

**Files:**
- Create: `pipeline/src/renderer/palette.ts`
- Create: `pipeline/src/renderer/version.ts`
- Create: `pipeline/tests/renderer/palette.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/renderer/palette.test.ts
import { describe, expect, it } from 'vitest';
import { hex } from '../../src/renderer/palette.ts';
import { RENDERER_VERSION } from '../../src/renderer/version.ts';

describe('palette', () => {
  it('maps named colors to hex (per spec 4.4 anchors)', () => {
    expect(hex('red')).toBe('#D32F2F');
    expect(hex('blue')).toBe('#1E5BCC');
    expect(hex('yellow')).toBe('#F5C518');
    expect(hex('black')).toBe('#111111');
    expect(hex('white')).toBe('#FAFAFA');
    expect(hex('accent_cyan')).toBe('#2A9DC9');
    expect(hex('accent_ochre')).toBe('#B8862E');
    expect(hex('accent_deep_red')).toBe('#8A1F1F');
  });
});

describe('renderer version', () => {
  it('exposes a semver string', () => {
    expect(RENDERER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// pipeline/src/renderer/palette.ts
import type { Color } from '../dsl/schema.ts';

const PALETTE: Record<Color, string> = {
  red: '#D32F2F',
  blue: '#1E5BCC',
  yellow: '#F5C518',
  black: '#111111',
  white: '#FAFAFA',
  accent_cyan: '#2A9DC9',
  accent_ochre: '#B8862E',
  accent_deep_red: '#8A1F1F',
};

export function hex(c: Color): string {
  return PALETTE[c];
}

export const FISH_CANVAS_BG = '#FAFAFA';
export const VIEWBOX = { w: 200, h: 140 } as const;
export const STROKE_CONTOUR = 2;
export const STROKE_ACCENT = 2.5;
```

```ts
// pipeline/src/renderer/version.ts
export const RENDERER_VERSION = '1.0.0';
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/renderer/palette.ts pipeline/src/renderer/version.ts pipeline/tests/renderer/palette.test.ts
git commit -m "$(cat <<'EOF'
feat(renderer): palette name→hex map and v1.0.0 constants

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Body primitive renderers

**Files:**
- Create: `pipeline/src/renderer/primitives.ts`
- Create: `pipeline/tests/renderer/primitives.test.ts`

Body is the largest, central element. Each primitive has a deterministic SVG fragment given (color, orientation, center, size).

- [ ] **Step 1: Write the failing tests**

```ts
// pipeline/tests/renderer/primitives.test.ts
import { describe, expect, it } from 'vitest';
import { renderBody } from '../../src/renderer/primitives.ts';

describe('renderBody', () => {
  it('renders triangle pointing right', () => {
    const svg = renderBody({ primitive: 'triangle', orientation: 'right', color: 'blue' });
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#1E5BCC'); // blue
    // Triangle pointing right: rightmost x ≈ viewbox right
    expect(svg).toMatch(/points="[\d., -]*"/);
  });

  it('renders ellipse', () => {
    const svg = renderBody({ primitive: 'ellipse', orientation: 'right', color: 'red' });
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('#D32F2F');
  });

  it('renders rectangle', () => {
    const svg = renderBody({ primitive: 'rectangle', orientation: 'right', color: 'yellow' });
    expect(svg).toContain('<rect');
    expect(svg).toContain('#F5C518');
  });

  it('is deterministic — same input produces identical output', () => {
    const a = renderBody({ primitive: 'ellipse', orientation: 'left', color: 'black' });
    const b = renderBody({ primitive: 'ellipse', orientation: 'left', color: 'black' });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement primitives**

```ts
// pipeline/src/renderer/primitives.ts
import { hex, VIEWBOX } from './palette.ts';
import type { Color, Primitive, Orientation } from './schema-helpers.ts';

// Local type aliases (avoid coupling primitives.ts to dsl/schema.ts directly)
export type RenderColor = Color;
export type RenderPrimitive = Primitive;
export type RenderOrientation = Orientation;

const CX = VIEWBOX.w / 2;     // 100
const CY = VIEWBOX.h / 2;     // 70
const BODY_W = 110;            // body horizontal extent (centered)
const BODY_H = 60;             // body vertical extent

interface BodyParams {
  primitive: RenderPrimitive;
  orientation: RenderOrientation;
  color: RenderColor;
}

export function renderBody({ primitive, orientation, color }: BodyParams): string {
  const fill = hex(color);
  const left = CX - BODY_W / 2;
  const right = CX + BODY_W / 2;
  const top = CY - BODY_H / 2;
  const bottom = CY + BODY_H / 2;

  switch (primitive) {
    case 'triangle': {
      // Triangle pointing in orientation direction
      const tip = orientation === 'right' ? right : left;
      const baseX = orientation === 'right' ? left : right;
      return `<polygon points="${tip},${CY} ${baseX},${top} ${baseX},${bottom}" fill="${fill}"/>`;
    }
    case 'ellipse': {
      const rx = BODY_W / 2;
      const ry = BODY_H / 2;
      return `<ellipse cx="${CX}" cy="${CY}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
    }
    case 'rectangle': {
      return `<rect x="${left}" y="${top}" width="${BODY_W}" height="${BODY_H}" fill="${fill}"/>`;
    }
    case 'semicircle': {
      // Semicircle with the flat side on the orientation side
      const r = BODY_H / 2;
      const flatX = orientation === 'right' ? right - r : left + r;
      // Use a path: half-circle
      const sweep = orientation === 'right' ? 0 : 1;
      return `<path d="M ${flatX} ${top} A ${r} ${r} 0 0 ${sweep} ${flatX} ${bottom} Z" fill="${fill}"/>`;
    }
    case 'composite_two_triangles': {
      // Two triangles sharing the base — diamond-ish, asymmetric for orientation
      const tip = orientation === 'right' ? right : left;
      const baseX = orientation === 'right' ? left : right;
      return [
        `<polygon points="${tip},${top} ${baseX},${CY} ${tip},${CY}" fill="${fill}"/>`,
        `<polygon points="${tip},${CY} ${baseX},${CY} ${tip},${bottom}" fill="${fill}"/>`,
      ].join('');
    }
    case 'semicircle_with_triangle': {
      // Semicircle on one side + triangle pointing the other way
      const r = BODY_H / 2;
      const flatX = orientation === 'right' ? right - r : left + r;
      const sweep = orientation === 'right' ? 0 : 1;
      const triTip = orientation === 'right' ? left : right;
      return [
        `<path d="M ${flatX} ${top} A ${r} ${r} 0 0 ${sweep} ${flatX} ${bottom} Z" fill="${fill}"/>`,
        `<polygon points="${flatX},${top} ${triTip},${CY} ${flatX},${bottom}" fill="${fill}"/>`,
      ].join('');
    }
  }
}
```

- [ ] **Step 4: Add the schema-helpers module**

```ts
// pipeline/src/renderer/schema-helpers.ts
// Re-export DSL primitive types for renderer modules to consume,
// keeping renderer free of DSL-validation logic
export type { Color, Primitive, Orientation } from '../dsl/schema.ts';
```

(Note: `Orientation` is not yet exported from schema.ts. Add it.)

```ts
// pipeline/src/dsl/schema.ts (modify line near OrientationSchema)
export type Orientation = z.infer<typeof OrientationSchema>;
```

- [ ] **Step 5: Run — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/renderer/primitives.ts pipeline/src/renderer/schema-helpers.ts pipeline/src/dsl/schema.ts pipeline/tests/renderer/primitives.test.ts
git commit -m "$(cat <<'EOF'
feat(renderer): body primitive renderers (6 primitives × 2 orientations)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.3: Tail, fin, eye renderers

**Files:**
- Modify: `pipeline/src/renderer/primitives.ts` (add `renderTail`, `renderFin`, `renderEye`)
- Modify: `pipeline/tests/renderer/primitives.test.ts` (add tests)

- [ ] **Step 1: Add tests**

```ts
// append to pipeline/tests/renderer/primitives.test.ts
import { renderTail, renderFin, renderEye } from '../../src/renderer/primitives.ts';

describe('renderTail', () => {
  it('renders a triangle on the side opposite to body orientation', () => {
    const svg = renderTail({ primitive: 'triangle', color: 'red', side: 'left' });
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#D32F2F');
  });
});

describe('renderEye', () => {
  it('renders double_circle (white outer + black inner)', () => {
    const svg = renderEye({ style: 'double_circle', position: 'front_top' });
    expect(svg).toMatch(/<circle.*#FAFAFA/);
    expect(svg).toMatch(/<circle.*#111111/);
  });
  it('renders dot as a single black circle', () => {
    const svg = renderEye({ style: 'dot', position: 'front_center' });
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBe(1);
  });
});

describe('renderFin', () => {
  it('renders top fin as a triangle above the body midline', () => {
    const svg = renderFin({ primitive: 'triangle', color: 'blue' }, 'top');
    expect(svg).toContain('<polygon');
  });
});
```

- [ ] **Step 2: Implement (append to `primitives.ts`)**

```ts
// append to pipeline/src/renderer/primitives.ts
const TAIL_W = 35;
const TAIL_H = 60;

interface TailParams { primitive: RenderPrimitive; color: RenderColor; side: RenderOrientation; }
export function renderTail({ primitive, color, side }: TailParams): string {
  const fill = hex(color);
  const baseX = side === 'left' ? CX - BODY_W / 2 : CX + BODY_W / 2;
  const tipX = side === 'left' ? baseX - TAIL_W : baseX + TAIL_W;
  const top = CY - TAIL_H / 2;
  const bottom = CY + TAIL_H / 2;

  switch (primitive) {
    case 'triangle':
      return `<polygon points="${baseX},${CY} ${tipX},${top} ${tipX},${bottom}" fill="${fill}"/>`;
    case 'rectangle':
      return `<rect x="${Math.min(baseX, tipX)}" y="${top}" width="${TAIL_W}" height="${TAIL_H}" fill="${fill}"/>`;
    default:
      // Other primitives degrade gracefully to triangle
      return `<polygon points="${baseX},${CY} ${tipX},${top} ${tipX},${bottom}" fill="${fill}"/>`;
  }
}

const FIN_SIZE = 20;
interface FinParams { primitive: RenderPrimitive; color: RenderColor; }
export function renderFin({ primitive, color }: FinParams, where: 'top' | 'bottom'): string {
  const fill = hex(color);
  const baseY = where === 'top' ? CY - BODY_H / 2 : CY + BODY_H / 2;
  const tipY = where === 'top' ? baseY - FIN_SIZE : baseY + FIN_SIZE;
  const x1 = CX - FIN_SIZE / 2;
  const x2 = CX + FIN_SIZE / 2;
  return `<polygon points="${x1},${baseY} ${x2},${baseY} ${CX},${tipY}" fill="${fill}"/>`;
}

interface EyeParams { style: 'double_circle' | 'dot' | 'circle' | 'square'; position: string; }
export function renderEye({ style, position }: EyeParams): string {
  // Position → coordinate (close to "head" — far from tail; default body midline)
  const eyeX = CX + 35; // default: front side of body
  const eyeY = position === 'front_top' ? CY - 12
            : position === 'front_low' ? CY + 12
            : CY;

  const outerR = 9;
  const innerR = 3.5;

  switch (style) {
    case 'double_circle':
      return [
        `<circle cx="${eyeX}" cy="${eyeY}" r="${outerR}" fill="#FAFAFA" stroke="#111111" stroke-width="2"/>`,
        `<circle cx="${eyeX}" cy="${eyeY}" r="${innerR}" fill="#111111"/>`,
      ].join('');
    case 'dot':
      return `<circle cx="${eyeX}" cy="${eyeY}" r="${innerR}" fill="#111111"/>`;
    case 'circle':
      return `<circle cx="${eyeX}" cy="${eyeY}" r="${outerR}" fill="none" stroke="#111111" stroke-width="2"/>`;
    case 'square':
      return `<rect x="${eyeX - outerR}" y="${eyeY - outerR}" width="${outerR * 2}" height="${outerR * 2}" fill="#111111"/>`;
  }
}
```

- [ ] **Step 3: Run — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/renderer/primitives.ts pipeline/tests/renderer/primitives.test.ts
git commit -m "$(cat <<'EOF'
feat(renderer): tail/fin/eye renderers with positional coordinates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.4: Background block + accents

**Files:**
- Modify: `pipeline/src/renderer/primitives.ts` (add `renderBackgroundBlock`, `renderAccent`)
- Modify: `pipeline/tests/renderer/primitives.test.ts`

- [ ] **Step 1: Add tests**

```ts
// append to pipeline/tests/renderer/primitives.test.ts
import { renderBackgroundBlock, renderAccent } from '../../src/renderer/primitives.ts';

describe('renderBackgroundBlock', () => {
  it('renders a colored rectangle at offset', () => {
    const svg = renderBackgroundBlock({ color: 'yellow', size: 'large', offset: [-15, -15] });
    expect(svg).toContain('<rect');
    expect(svg).toContain('#F5C518');
  });
});

describe('renderAccent', () => {
  it('renders horizontal_line as a line element', () => {
    const svg = renderAccent({ type: 'horizontal_line', color: 'black', position: 'midline' });
    expect(svg).toContain('<line');
    expect(svg).toContain('#111111');
  });
  it('renders dot as a small circle', () => {
    const svg = renderAccent({ type: 'dot', color: 'red', position: 'midline' });
    expect(svg).toContain('<circle');
  });
});
```

- [ ] **Step 2: Implement (append)**

```ts
// append to pipeline/src/renderer/primitives.ts

const BLOCK_SIZES = { small: { w: 80, h: 60 }, medium: { w: 100, h: 80 }, large: { w: 130, h: 100 } } as const;

interface BgBlockParams { color: RenderColor; size: 'small'|'medium'|'large'; offset: [number, number]; }
export function renderBackgroundBlock({ color, size, offset }: BgBlockParams): string {
  const fill = hex(color);
  const dim = BLOCK_SIZES[size];
  const x = (VIEWBOX.w - dim.w) / 2 + offset[0];
  const y = (VIEWBOX.h - dim.h) / 2 + offset[1];
  return `<rect x="${x}" y="${y}" width="${dim.w}" height="${dim.h}" fill="${fill}"/>`;
}

interface AccentParams { type: string; color: RenderColor; position: string; }
export function renderAccent({ type, color, position }: AccentParams): string {
  const stroke = hex(color);
  const yMap: Record<string, number> = {
    midline: CY, low: CY + 18, front_top: CY - 18, front_center: CY,
    front_low: CY + 12, head_top: CY - 25, head_bottom: CY + 25,
    tail_side: CY,
  };
  const y = yMap[position] ?? CY;

  switch (type) {
    case 'horizontal_line':
      return `<line x1="${CX - BODY_W/2 + 5}" y1="${y}" x2="${CX + BODY_W/2 - 5}" y2="${y}" stroke="${stroke}" stroke-width="2.5"/>`;
    case 'horizontal_band':
      return `<rect x="${CX - BODY_W/2}" y="${y - 7}" width="${BODY_W}" height="14" fill="${stroke}"/>`;
    case 'dot':
      return `<circle cx="${CX}" cy="${y}" r="3" fill="${stroke}"/>`;
    case 'small_triangle':
      return `<polygon points="${CX-5},${y+5} ${CX+5},${y+5} ${CX},${y-5}" fill="${stroke}"/>`;
    case 'small_square':
      return `<rect x="${CX-4}" y="${y-4}" width="8" height="8" fill="${stroke}"/>`;
    default:
      return '';
  }
}
```

- [ ] **Step 3: Run — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/renderer/primitives.ts pipeline/tests/renderer/primitives.test.ts
git commit -m "$(cat <<'EOF'
feat(renderer): background block and accent primitive renderers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.5: Main `render(dsl)` composition + golden tests

**Files:**
- Create: `pipeline/src/renderer/renderer.ts`
- Create: `pipeline/tests/renderer/renderer.test.ts`
- Create: `pipeline/tests/renderer/__golden__/triangle-arrow.svg` (after first run; see Step 5)

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/renderer/renderer.test.ts
import { describe, expect, it } from 'vitest';
import { render } from '../../src/renderer/renderer.ts';
import type { DSL } from '../../src/dsl/schema.ts';

const triangleArrow: DSL = {
  body: { primitive: 'composite_two_triangles', orientation: 'right', color: 'blue' },
  eye: { style: 'double_circle', position: 'front_top' },
  tail: { primitive: 'triangle', color: 'red', side: 'left' },
  fin_top: null, fin_bottom: null,
  background_block: { color: 'yellow', size: 'large', offset: [-15, -15] },
  accents: [{ type: 'horizontal_line', color: 'black', position: 'midline' }],
};

describe('render', () => {
  it('produces a complete SVG document', () => {
    const svg = render(triangleArrow);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox="0 0 200 140"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('orders elements: bg fill → bg_block → accents → body → tail → fins → eye', () => {
    const svg = render(triangleArrow);
    // Yellow block must appear BEFORE blue body
    const yellowIdx = svg.indexOf('#F5C518');
    const blueIdx = svg.indexOf('#1E5BCC');
    expect(yellowIdx).toBeGreaterThan(0);
    expect(blueIdx).toBeGreaterThan(yellowIdx);
  });

  it('embeds intrinsic canvas (#FAFAFA) when no bg_block', () => {
    const noBg = { ...triangleArrow, background_block: null };
    const svg = render(noBg);
    expect(svg).toContain('#FAFAFA');
  });

  it('is deterministic — same DSL → identical SVG', () => {
    expect(render(triangleArrow)).toBe(render(triangleArrow));
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// pipeline/src/renderer/renderer.ts
import type { DSL } from '../dsl/schema.ts';
import {
  renderBody, renderTail, renderFin, renderEye,
  renderBackgroundBlock, renderAccent,
} from './primitives.ts';
import { FISH_CANVAS_BG, VIEWBOX } from './palette.ts';

export function render(dsl: DSL): string {
  const parts: string[] = [];

  // 1. Intrinsic canvas (only when no bg_block — bg_block dominates)
  if (!dsl.background_block) {
    parts.push(`<rect x="0" y="0" width="${VIEWBOX.w}" height="${VIEWBOX.h}" fill="${FISH_CANVAS_BG}"/>`);
  } else {
    // Even with bg_block, fill base with canvas — bg_block is offset and may not cover edges
    parts.push(`<rect x="0" y="0" width="${VIEWBOX.w}" height="${VIEWBOX.h}" fill="${FISH_CANVAS_BG}"/>`);
    parts.push(renderBackgroundBlock(dsl.background_block));
  }

  // 2. Accents go behind body for compositional layering
  for (const a of dsl.accents) parts.push(renderAccent(a));

  // 3. Body
  parts.push(renderBody(dsl.body));

  // 4. Tail (sits behind body visually but rendered after for the join illusion)
  if (dsl.tail) parts.push(renderTail(dsl.tail));

  // 5. Fins
  if (dsl.fin_top) parts.push(renderFin(dsl.fin_top, 'top'));
  if (dsl.fin_bottom) parts.push(renderFin(dsl.fin_bottom, 'bottom'));

  // 6. Eye (always on top)
  parts.push(renderEye(dsl.eye));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" width="${VIEWBOX.w}" height="${VIEWBOX.h}">${parts.join('')}</svg>`;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Add a golden snapshot for visual regression**

```ts
// append to pipeline/tests/renderer/renderer.test.ts
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(__dirname, '__golden__', 'triangle-arrow.svg');

describe('golden snapshot', () => {
  it('triangle-arrow matches stored golden', () => {
    const svg = render(triangleArrow);
    if (!existsSync(goldenPath)) {
      writeFileSync(goldenPath, svg);
      throw new Error(`Wrote initial golden to ${goldenPath}; commit and re-run.`);
    }
    const golden = readFileSync(goldenPath, 'utf-8');
    expect(svg).toBe(golden);
  });
});
```

- [ ] **Step 6: Run twice — first creates golden, second passes**

```bash
mkdir -p pipeline/tests/renderer/__golden__
npm --workspace pipeline run test:run -- tests/renderer/renderer.test.ts  # creates golden, fails
npm --workspace pipeline run test:run -- tests/renderer/renderer.test.ts  # passes
```

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/renderer/renderer.ts pipeline/tests/renderer/renderer.test.ts pipeline/tests/renderer/__golden__/
git commit -m "$(cat <<'EOF'
feat(renderer): main render() with deterministic composition + golden

Layer order: canvas → bg_block → accents → body → tail → fins → eye.
Golden snapshot guards against accidental visual regression.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Storage

### Task 4.1: Path utilities

**Files:**
- Create: `pipeline/src/storage/paths.ts`
- Create: `pipeline/tests/storage/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/storage/paths.test.ts
import { describe, expect, it } from 'vitest';
import { fishJsonPath, fishSvgPath, emptyDayPath, FISH_DIR } from '../../src/storage/paths.ts';

describe('paths', () => {
  it('builds canonical fish JSON path', () => {
    expect(fishJsonPath('2026-04-25')).toBe(`${FISH_DIR}/2026-04-25.json`);
  });
  it('builds canonical fish SVG path', () => {
    expect(fishSvgPath('2026-04-25')).toBe(`${FISH_DIR}/2026-04-25.svg`);
  });
  it('builds empty-day marker path', () => {
    expect(emptyDayPath('2026-04-25')).toBe(`${FISH_DIR}/2026-04-25.empty.json`);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// pipeline/src/storage/paths.ts
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// pipeline/src/storage/paths.ts → repo root: ../../../
export const REPO_ROOT = resolve(__dirname, '../../..');
export const FISH_DIR = join(REPO_ROOT, 'fish');

export function fishJsonPath(date: string): string { return join(FISH_DIR, `${date}.json`); }
export function fishSvgPath(date: string): string { return join(FISH_DIR, `${date}.svg`); }
export function emptyDayPath(date: string): string { return join(FISH_DIR, `${date}.empty.json`); }
```

Note: the test compares with template-literal `${FISH_DIR}/...`. On Windows, `join` uses backslash. Adjust the test to use `join` too:

- [ ] **Step 3a: Re-write the test using `join` for cross-platform**

```ts
// pipeline/tests/storage/paths.test.ts (rewrite)
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fishJsonPath, fishSvgPath, emptyDayPath, FISH_DIR } from '../../src/storage/paths.ts';

describe('paths', () => {
  it('builds canonical fish JSON path', () => {
    expect(fishJsonPath('2026-04-25')).toBe(join(FISH_DIR, '2026-04-25.json'));
  });
  it('builds canonical fish SVG path', () => {
    expect(fishSvgPath('2026-04-25')).toBe(join(FISH_DIR, '2026-04-25.svg'));
  });
  it('builds empty-day marker path', () => {
    expect(emptyDayPath('2026-04-25')).toBe(join(FISH_DIR, '2026-04-25.empty.json'));
  });
});
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/storage/paths.ts pipeline/tests/storage/paths.test.ts
git commit -m "$(cat <<'EOF'
feat(storage): cross-platform path utilities for fish/ records

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2: Fish read + write

**Files:**
- Create: `pipeline/src/storage/storage.ts`
- Create: `pipeline/tests/storage/storage.test.ts`
- Create: `fish/.gitkeep` (so dir exists)

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/storage/storage.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFish, readFish, type FishRecord } from '../../src/storage/storage.ts';

const sample: FishRecord = {
  date: '2026-04-25',
  stage1: { word: 'मानसून', language: 'Hindi', transliteration: 'mansoon', russian_meaning: 'сезон дождей' },
  stage2: { description: 'Рыба, плывущая против течения собственных слёз.' },
  stage3: {
    dsl: {
      body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
      eye: { style: 'double_circle', position: 'front_top' },
      tail: { primitive: 'triangle', color: 'red', side: 'left' },
      fin_top: null, fin_bottom: null,
      background_block: null,
      accents: [],
    },
  },
  signature: { body_primitive: 'ellipse', body_color: 'blue', has_bg_block: false, bg_color: null, has_tail: true },
  renderer_version: '1.0.0',
  model_version: 'anthropic/claude-opus-4.7',
};

describe('writeFish + readFish', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'rybov-')); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('writes JSON and SVG to dir', async () => {
    await writeFish(tmpDir, sample, '<svg></svg>');
    expect(existsSync(join(tmpDir, '2026-04-25.json'))).toBe(true);
    expect(existsSync(join(tmpDir, '2026-04-25.svg'))).toBe(true);
  });

  it('reads back what it wrote', async () => {
    await writeFish(tmpDir, sample, '<svg></svg>');
    const round = await readFish(tmpDir, '2026-04-25');
    expect(round).toEqual({ record: sample, svg: '<svg></svg>' });
  });

  it('returns null for missing date', async () => {
    expect(await readFish(tmpDir, '2099-12-31')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// pipeline/src/storage/storage.ts
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DSL } from '../dsl/schema.ts';
import type { Signature } from '../dsl/signature.ts';

export interface Stage1Output {
  word: string;
  language: string;
  transliteration: string | null;
  russian_meaning: string;
}

export interface Stage2Output { description: string; }

export interface Stage3Output { dsl: DSL; }

export interface FishRecord {
  date: string;
  stage1: Stage1Output;
  stage2: Stage2Output;
  stage3: Stage3Output;
  signature: Signature;
  renderer_version: string;
  model_version: string;
}

export interface EmptyDayRecord {
  date: string;
  reason: string;
  failed_stage: 'stage1' | 'stage2' | 'stage3' | 'render' | 'storage';
  model_version: string;
  renderer_version: string;
}

export async function writeFish(dir: string, record: FishRecord, svg: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${record.date}.json`), JSON.stringify(record, null, 2), 'utf-8');
  await writeFile(join(dir, `${record.date}.svg`), svg, 'utf-8');
}

export async function readFish(dir: string, date: string): Promise<{ record: FishRecord; svg: string } | null> {
  const jsonPath = join(dir, `${date}.json`);
  const svgPath = join(dir, `${date}.svg`);
  if (!existsSync(jsonPath) || !existsSync(svgPath)) return null;
  const record = JSON.parse(await readFile(jsonPath, 'utf-8')) as FishRecord;
  const svg = await readFile(svgPath, 'utf-8');
  return { record, svg };
}

export async function writeEmptyDay(dir: string, record: EmptyDayRecord): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${record.date}.empty.json`), JSON.stringify(record, null, 2), 'utf-8');
}

export async function readEmptyDay(dir: string, date: string): Promise<EmptyDayRecord | null> {
  const path = join(dir, `${date}.empty.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8')) as EmptyDayRecord;
}
```

- [ ] **Step 4: Create the `fish/` directory placeholder**

```bash
mkdir -p fish
touch fish/.gitkeep
```

- [ ] **Step 5: Run — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/storage/storage.ts pipeline/tests/storage/storage.test.ts fish/.gitkeep
git commit -m "$(cat <<'EOF'
feat(storage): writeFish/readFish + empty-day marker IO

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.3: Anti-repeat extraction

**Files:**
- Create: `pipeline/src/storage/antirepeat.ts`
- Create: `pipeline/tests/storage/antirepeat.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/storage/antirepeat.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFish, type FishRecord } from '../../src/storage/storage.ts';
import { getRecentWords } from '../../src/storage/antirepeat.ts';

function record(date: string, word: string): FishRecord {
  return {
    date,
    stage1: { word, language: 'X', transliteration: null, russian_meaning: 'm' },
    stage2: { description: 'd' },
    stage3: { dsl: {
      body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
      eye: { style: 'double_circle', position: 'front_top' },
      tail: null, fin_top: null, fin_bottom: null,
      background_block: null, accents: [],
    } },
    signature: { body_primitive: 'ellipse', body_color: 'blue', has_bg_block: false, bg_color: null, has_tail: false },
    renderer_version: '1.0.0',
    model_version: 'x',
  };
}

describe('getRecentWords', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'rybov-ar-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns empty array for empty storage', async () => {
    expect(await getRecentWords(dir, 30)).toEqual([]);
  });

  it('returns last N words sorted by date desc', async () => {
    await writeFish(dir, record('2026-04-23', 'foo'), '<svg/>');
    await writeFish(dir, record('2026-04-25', 'bar'), '<svg/>');
    await writeFish(dir, record('2026-04-24', 'baz'), '<svg/>');
    expect(await getRecentWords(dir, 30)).toEqual(['bar', 'baz', 'foo']);
  });

  it('caps at limit', async () => {
    for (let i = 1; i <= 35; i++) {
      const d = `2026-04-${String(i).padStart(2, '0')}`;
      await writeFish(dir, record(d, `w${i}`), '<svg/>');
    }
    const r = await getRecentWords(dir, 30);
    expect(r.length).toBe(30);
    expect(r[0]).toBe('w35');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// pipeline/src/storage/antirepeat.ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { FishRecord } from './storage.ts';

export async function getRecentWords(dir: string, limit: number): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const fishFiles = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
    .slice(0, limit);
  const words: string[] = [];
  for (const f of fishFiles) {
    const record = JSON.parse(await readFile(join(dir, f), 'utf-8')) as FishRecord;
    words.push(record.stage1.word);
  }
  return words;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/storage/antirepeat.ts pipeline/tests/storage/antirepeat.test.ts
git commit -m "$(cat <<'EOF'
feat(storage): getRecentWords for stage 1 anti-repeat input

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Publishing Module

### Task 5.1: `getCanonicalFish` + types

**Files:**
- Create: `pipeline/src/publishing/publishing.ts`
- Create: `pipeline/tests/publishing/publishing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/tests/publishing/publishing.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFish, writeEmptyDay, type FishRecord } from '../../src/storage/storage.ts';
import { getCanonicalFish, getCanonicalEmptyDay, type SiteConfig } from '../../src/publishing/publishing.ts';

const cfg: SiteConfig = {
  baseUrl: 'https://hedgeinform.example/rybov_show',
};

const sample: FishRecord = {
  date: '2026-04-25',
  stage1: { word: 'мост', language: 'Russian', transliteration: null, russian_meaning: 'мост' },
  stage2: { description: 'Рыба-мост между двумя берегами одного течения.' },
  stage3: { dsl: {
    body: { primitive: 'rectangle', orientation: 'right', color: 'blue' },
    eye: { style: 'double_circle', position: 'front_center' },
    tail: null, fin_top: null, fin_bottom: null,
    background_block: null, accents: [],
  } },
  signature: { body_primitive: 'rectangle', body_color: 'blue', has_bg_block: false, bg_color: null, has_tail: false },
  renderer_version: '1.0.0',
  model_version: 'anthropic/claude-opus-4.7',
};

describe('getCanonicalFish', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'rybov-pub-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns CanonicalFish for an existing day', async () => {
    await writeFish(dir, sample, '<svg id="x"/>');
    const f = await getCanonicalFish(dir, '2026-04-25', cfg);
    expect(f).not.toBeNull();
    if (!f) return;
    expect(f.permalinkUrl).toBe('https://hedgeinform.example/rybov_show/2026-04-25');
    expect(f.svg).toBe('<svg id="x"/>');
    expect(f.ogMeta.title).toContain('мост');
    expect(f.ogMeta.description).toContain('берегами');
    expect(f.altText).toMatch(/Concept fish for 2026-04-25/);
  });

  it('returns null for missing day', async () => {
    expect(await getCanonicalFish(dir, '2099-12-31', cfg)).toBeNull();
  });
});

describe('getCanonicalEmptyDay', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'rybov-emp-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns EmptyDay info when present', async () => {
    await writeEmptyDay(dir, {
      date: '2026-04-25',
      reason: 'OpenRouter 503',
      failed_stage: 'stage1',
      model_version: 'anthropic/claude-opus-4.7',
      renderer_version: '1.0.0',
    });
    const e = await getCanonicalEmptyDay(dir, '2026-04-25', cfg);
    expect(e).not.toBeNull();
    if (!e) return;
    expect(e.permalinkUrl).toBe('https://hedgeinform.example/rybov_show/2026-04-25');
    expect(e.reason).toBe('OpenRouter 503');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// pipeline/src/publishing/publishing.ts
import { readFish, readEmptyDay, type FishRecord, type EmptyDayRecord } from '../storage/storage.ts';

export interface SiteConfig { baseUrl: string; /* no trailing slash */ }

export interface CanonicalFish {
  date: string;
  record: FishRecord;
  svg: string;
  permalinkUrl: string;
  altText: string;
  ogMeta: {
    title: string;
    description: string;
    image: string; // absolute URL to SVG (or PNG when generated)
  };
  // Note: prev/next navigation links are intentionally out of MVP scope.
  // The archive page (Task 8.4) provides browsing; per-fish prev/next can
  // be added later by extending getCanonicalFish to take an ordered date list.
}

export interface CanonicalEmptyDay {
  date: string;
  reason: string;
  permalinkUrl: string;
}

export async function getCanonicalFish(
  dir: string,
  date: string,
  cfg: SiteConfig,
): Promise<CanonicalFish | null> {
  const r = await readFish(dir, date);
  if (!r) return null;
  const { record, svg } = r;
  const permalinkUrl = `${cfg.baseUrl}/${date}`;
  const word = record.stage1.word;
  const description = record.stage2.description;
  return {
    date,
    record,
    svg,
    permalinkUrl,
    altText: `Concept fish for ${date}, generated from the word "${word}".`,
    ogMeta: {
      title: `${date} · ${word} — Rybov`,
      description: description.slice(0, 200),
      image: `${permalinkUrl}.svg`,
    },
  };
}

export async function getCanonicalEmptyDay(
  dir: string,
  date: string,
  cfg: SiteConfig,
): Promise<CanonicalEmptyDay | null> {
  const r = await readEmptyDay(dir, date);
  if (!r) return null;
  return { date, reason: r.reason, permalinkUrl: `${cfg.baseUrl}/${date}` };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/publishing/publishing.ts pipeline/tests/publishing/publishing.test.ts
git commit -m "$(cat <<'EOF'
feat(publishing): canonical fish + empty-day forms with permalink/OG

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — LLM Integration

> **Prerequisite:** Task 1.1 must be complete. The findings in `docs/notes/openrouter-verification.md` determine `OPENROUTER_REASONING_SUPPORTED` and `OPENROUTER_CACHING_SUPPORTED` flags below.

### Task 6.1: API client wrapper

**Files:**
- Create: `pipeline/src/llm/client.ts`

- [ ] **Step 1: Implement (no unit test — integration tested via stages)**

Set the two boolean constants based on Task 1.1 verification findings.

```ts
// pipeline/src/llm/client.ts
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MODEL = 'anthropic/claude-opus-4.7';

// Set from docs/notes/openrouter-verification.md findings:
export const OPENROUTER_REASONING_SUPPORTED = true; // adjust after Task 1.1
export const OPENROUTER_CACHING_SUPPORTED = true;   // adjust after Task 1.1
export const REASONING_EFFORT: 'high' | 'medium' | 'low' | 'minimal' = 'high';

export interface CallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  cacheSystem?: boolean;
}

export interface CallResult {
  text: string;
  rawResponse: unknown;
}

export async function callOpus(opts: CallOptions): Promise<CallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const systemContent = OPENROUTER_CACHING_SUPPORTED && opts.cacheSystem
    ? [{ type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }]
    : opts.systemPrompt;

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: opts.userPrompt },
    ],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };

  if (OPENROUTER_REASONING_SUPPORTED) {
    body.reasoning = { effort: REASONING_EFFORT };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/Hedgeinform/rybov',
      'X-Title': 'Rybov daily fish',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errBody}`);
  }

  const json = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = json.choices[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty completion from OpenRouter');
  return { text, rawResponse: json };
}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/src/llm/client.ts
git commit -m "$(cat <<'EOF'
feat(llm): OpenRouter client wrapper with conditional caching/reasoning

Feature flags OPENROUTER_REASONING_SUPPORTED / OPENROUTER_CACHING_SUPPORTED
are set based on Task 1.1 verification findings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.2: Stage 1 — Word draw

**Files:**
- Create: `pipeline/src/llm/stage1.ts`

- [ ] **Step 1: Implement**

```ts
// pipeline/src/llm/stage1.ts
import { z } from 'zod';
import { callOpus } from './client.ts';
import type { Stage1Output } from '../storage/storage.ts';

const Stage1Schema = z.object({
  word: z.string().min(1),
  language: z.string().min(1),
  transliteration: z.string().nullable(),
  russian_meaning: z.string().min(1),
});

const SYSTEM_PROMPT = `You pick a single word in any language of the world. The word can be a noun, verb, adjective, abstract concept, or named thing. Languages span the globe — Latin scripts, Cyrillic, Devanagari, Arabic, CJK, African, Polynesian, anything you know. Avoid the words listed under AVOID below.

Return STRICT JSON only:
{
  "word": "<the word in its native script>",
  "language": "<English name of the language>",
  "transliteration": "<Latin-letter approximation, or null if word is already Latin>",
  "russian_meaning": "<a Russian word or short phrase that translates the meaning>"
}

No prose around the JSON. No markdown fences. Just the JSON object.`;

export async function runStage1(avoidWords: string[]): Promise<Stage1Output> {
  const userPrompt = avoidWords.length === 0
    ? 'Pick a word.'
    : `AVOID:\n${avoidWords.map((w) => `- ${w}`).join('\n')}\n\nPick a word.`;

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const { text } = await callOpus({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 1.0,
      maxTokens: 300,
      cacheSystem: true,
    });
    try {
      const parsed = Stage1Schema.parse(JSON.parse(text));
      return parsed;
    } catch (e) {
      lastError = String(e);
    }
  }
  throw new Error(`Stage 1 failed after 3 attempts (2 retries). Last error: ${lastError}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/src/llm/stage1.ts
git commit -m "$(cat <<'EOF'
feat(llm): stage 1 word draw with anti-repeat input and JSON-only output

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.3: Stage 2 — Fish vision

**Files:**
- Create: `pipeline/src/llm/stage2.ts`

- [ ] **Step 1: Implement**

```ts
// pipeline/src/llm/stage2.ts
import { callOpus } from './client.ts';
import type { Stage1Output, Stage2Output } from '../storage/storage.ts';

const SYSTEM_PROMPT = `You receive a single word with its meaning. Imagine a fish that comes to mind from this word. Describe the fish in 1 to 3 short sentences in Russian.

Hard constraints:
- Describe ONLY the visual (shape, color, posture, presence/absence of features). NOT what the fish "means" or "represents" or "symbolizes".
- Do NOT use the words: символизирует, означает, представляет, потому что, поэтому, как будто, как если бы, метафора, аллегория, symbolizes, represents, means, because, therefore, as if, metaphor, allegory.
- Do NOT explain the connection between the word and the fish. Just describe the fish.
- Maximum 3 sentences.

Return ONLY the description text. No prose label, no JSON, no quotes.`;

const FORBIDDEN_PATTERNS = [
  /символизи/i, /означа/i, /представля/i,
  /потому что/i, /поэтому/i, /как будто/i, /как если бы/i,
  /метафор/i, /аллегор/i,
  /\bsymboliz/i, /\brepresent/i, /\bmeans?\b/i,
  /\bbecause\b/i, /\btherefore\b/i, /\bas if\b/i,
  /\bmetaphor/i, /\ballegor/i,
];

function violatesGuardrails(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

export async function runStage2(stage1: Stage1Output): Promise<Stage2Output> {
  const userPrompt = `Word: ${stage1.word}\nLanguage: ${stage1.language}\nMeaning (Russian): ${stage1.russian_meaning}`;

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const tightening = attempt === 0 ? '' : '\n\nReminder: visual description only. No symbolism.';
    const { text } = await callOpus({
      systemPrompt: SYSTEM_PROMPT + tightening,
      userPrompt,
      temperature: 0.9,
      maxTokens: 400,
      cacheSystem: attempt === 0,
    });
    const trimmed = text.trim();
    if (violatesGuardrails(trimmed)) {
      lastError = `Guardrail violation: "${trimmed.slice(0, 80)}..."`;
      continue;
    }
    const sentences = trimmed.split(/[.!?]\s+/).filter(Boolean).length;
    if (sentences > 3) {
      lastError = `Too many sentences (${sentences} > 3)`;
      continue;
    }
    return { description: trimmed };
  }
  throw new Error(`Stage 2 failed after 3 attempts (2 retries). Last error: ${lastError}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/src/llm/stage2.ts
git commit -m "$(cat <<'EOF'
feat(llm): stage 2 fish vision with no-explanation guardrails

Detects forbidden patterns (symbolizes, represents, etc. in RU+EN) and
retries with a tightened reminder prompt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.4: Stage 3 — Form translation

**Files:**
- Create: `pipeline/src/llm/stage3.ts`

- [ ] **Step 1: Implement**

```ts
// pipeline/src/llm/stage3.ts
import { callOpus } from './client.ts';
import { validate } from '../dsl/validator.ts';
import { COLORS, PRIMITIVES, POSITIONS, SIZES, OFFSET_VALUES, EYE_STYLES, ACCENT_TYPES, type DSL } from '../dsl/schema.ts';
import type { Stage2Output, Stage3Output } from '../storage/storage.ts';

const SCHEMA_DOC = `
DSL schema (use ONLY these enum values; never invent new ones):

- body (REQUIRED): { primitive, orientation, color }
- eye (REQUIRED): { style, position }
- tail (optional, may be null): { primitive, color, side }
- fin_top, fin_bottom (optional, may be null): { primitive, color }
- background_block (optional, may be null): { color, size, offset: [x, y] }
- accents (optional array, max 3): [{ type, color, position }]

Enums:
- primitive: ${PRIMITIVES.join(' | ')}
- color: ${COLORS.join(' | ')}
- orientation: left | right
- side (for tail): left | right (must be opposite to body.orientation)
- position: ${POSITIONS.join(' | ')}
- size: ${SIZES.join(' | ')}
- offset values: each axis from { ${OFFSET_VALUES.join(', ')} }
- eye style: ${EYE_STYLES.join(' | ')}
- accent type: ${ACCENT_TYPES.join(' | ')}

Constraints:
- Distinct colors across the whole fish: max 4
- tail.side opposite to body.orientation (or tail = null)
`;

const SYSTEM_PROMPT = `You translate a Russian fish description into structured DSL parameters that a procedural renderer will execute.

${SCHEMA_DOC}

Return STRICT JSON matching the schema. No prose, no markdown fences, no explanations. Just the JSON object with exactly these keys: body, eye, tail, fin_top, fin_bottom, background_block, accents.`;

export async function runStage3(stage2: Stage2Output): Promise<Stage3Output> {
  const baseUserPrompt = `Description:\n${stage2.description}\n\nReturn the DSL JSON.`;
  let userPrompt = baseUserPrompt;
  let lastError = '';

  for (let attempt = 0; attempt < 5; attempt++) {
    const { text } = await callOpus({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 800,
      cacheSystem: true,
    });
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch (e) {
      lastError = `JSON parse error: ${e}`;
      userPrompt = `${baseUserPrompt}\n\nPrevious attempt was not valid JSON. Return ONLY a JSON object.`;
      continue;
    }
    const result = validate(parsed);
    if (result.ok) return { dsl: result.dsl };
    lastError = `Validator: ${result.error}`;
    userPrompt = `${baseUserPrompt}\n\nPrevious attempt was rejected: ${result.error}\nFix and retry.`;
  }
  throw new Error(`Stage 3 failed after 5 attempts (4 retries). Last error: ${lastError}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/src/llm/stage3.ts
git commit -m "$(cat <<'EOF'
feat(llm): stage 3 form translation with validator-feedback retries

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Pipeline Orchestration

### Task 7.1: Daily orchestration

**Files:**
- Create: `pipeline/src/pipeline/daily.ts`
- Create: `pipeline/src/shared/dates.ts`

- [ ] **Step 1: Date helper**

```ts
// pipeline/src/shared/dates.ts
export function todayUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 2: Pipeline implementation**

```ts
// pipeline/src/pipeline/daily.ts
import { runStage1 } from '../llm/stage1.ts';
import { runStage2 } from '../llm/stage2.ts';
import { runStage3 } from '../llm/stage3.ts';
import { render } from '../renderer/renderer.ts';
import { computeSignature } from '../dsl/signature.ts';
import { writeFish, writeEmptyDay, type FishRecord, type EmptyDayRecord } from '../storage/storage.ts';
import { getRecentWords } from '../storage/antirepeat.ts';
import { FISH_DIR } from '../storage/paths.ts';
import { RENDERER_VERSION } from '../renderer/version.ts';
import { MODEL } from '../llm/client.ts';
import { todayUtc } from '../shared/dates.ts';

export interface DailyResult {
  ok: boolean;
  date: string;
  record?: FishRecord;
  empty?: EmptyDayRecord;
}

export async function runDaily(opts?: { date?: string; dryRun?: boolean }): Promise<DailyResult> {
  const date = opts?.date ?? todayUtc();
  const dryRun = opts?.dryRun ?? false;
  const targetDir = dryRun ? `/tmp/rybov-dry-${Date.now()}` : FISH_DIR;

  const recordEmpty = (failed_stage: EmptyDayRecord['failed_stage'], reason: string): EmptyDayRecord => ({
    date, reason, failed_stage, model_version: MODEL, renderer_version: RENDERER_VERSION,
  });

  // Stage 1
  const recentWords = await getRecentWords(FISH_DIR, 30);
  let stage1;
  try { stage1 = await runStage1(recentWords); }
  catch (e) {
    const empty = recordEmpty('stage1', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Stage 2
  let stage2;
  try { stage2 = await runStage2(stage1); }
  catch (e) {
    const empty = recordEmpty('stage2', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Stage 3
  let stage3;
  try { stage3 = await runStage3(stage2); }
  catch (e) {
    const empty = recordEmpty('stage3', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Render
  let svg: string;
  try { svg = render(stage3.dsl); }
  catch (e) {
    const empty = recordEmpty('render', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Compose record
  const record: FishRecord = {
    date,
    stage1, stage2, stage3,
    signature: computeSignature(stage3.dsl),
    renderer_version: RENDERER_VERSION,
    model_version: MODEL,
  };

  // Storage
  try { await writeFish(targetDir, record, svg); }
  catch (e) {
    const empty = recordEmpty('storage', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  return { ok: true, date, record };
}
```

- [ ] **Step 3: Entry-point scripts**

```ts
// pipeline/src/scripts/run-daily.ts
import { runDaily } from '../pipeline/daily.ts';

const result = await runDaily();
if (result.ok) {
  console.log(`OK: ${result.date} — ${result.record?.stage1.word}`);
  process.exit(0);
} else {
  console.error(`DAY FAIL: ${result.date} — ${result.empty?.failed_stage}: ${result.empty?.reason}`);
  process.exit(2); // distinct from generic failure for CI handling
}
```

```ts
// pipeline/src/scripts/dry-run.ts
import { runDaily } from '../pipeline/daily.ts';
import { todayUtc } from '../shared/dates.ts';

const dateArg = process.argv[2];
const date = dateArg ?? todayUtc();
const result = await runDaily({ date, dryRun: true });
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/pipeline/ pipeline/src/shared/dates.ts pipeline/src/scripts/run-daily.ts pipeline/src/scripts/dry-run.ts
git commit -m "$(cat <<'EOF'
feat(pipeline): atomic daily run with empty-day fallback per stage

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.2: Manual smoke test

- [ ] **Step 1: Run dry-run with valid `.env`**

```bash
npm run dry-run
```

Expected output: a JSON dump of `DailyResult`. If `ok: true` — read the record's `stage1.word`, `stage2.description`, and inspect the SVG written to the temp dir.

- [ ] **Step 2: Eyeball the generated SVG**

Open the SVG file (path printed by the script) in a browser. Confirm:
- It looks like a fish (recognizably constructivist)
- It has no rendering errors
- Composition makes sense

- [ ] **Step 3: If quality is poor, iterate on prompts**

This is the eyeball-feedback loop. Adjust system prompts in `stage1.ts` / `stage2.ts` / `stage3.ts` based on what you see. **Do not commit prompt changes without running dry-run again.**

- [ ] **Step 4: Once happy, commit any prompt refinements**

```bash
git add pipeline/src/llm/
git commit -m "$(cat <<'EOF'
fix(llm): refine prompts based on dry-run smoke test feedback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Skip if no refinements needed.)

---

## Phase 8 — Web (Astro)

### Task 8.1: Initialize Astro workspace

**Files:**
- Create: `web/package.json`
- Create: `web/astro.config.mjs`
- Create: `web/tsconfig.json`
- Create: `web/src/pages/index.astro` (placeholder)

- [ ] **Step 1: Write `web/package.json`**

```json
{
  "name": "@rybov/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^4.16.0"
  }
}
```

- [ ] **Step 2: Write `web/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

const RYBOV_BASE = process.env.RYBOV_BASE_PATH ?? '/';

export default defineConfig({
  site: process.env.RYBOV_SITE_URL ?? 'https://hedgeinform.example',
  base: RYBOV_BASE,
  trailingSlash: 'never',
  output: 'static',
  build: {
    format: 'file',
  },
});
```

- [ ] **Step 3: Write `web/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

- [ ] **Step 4: Placeholder index page**

```astro
---
// web/src/pages/index.astro
---
<html><body><h1>Rybov — coming soon</h1></body></html>
```

- [ ] **Step 5: Install + smoke test**

```bash
npm install
npm run build:web
```

Expected: `web/dist/index.html` exists.

- [ ] **Step 6: Commit**

```bash
git add web/ package-lock.json
git commit -m "$(cat <<'EOF'
chore(web): scaffold Astro workspace with base-path env config

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.2: Layout with arkadiy-ds tokens + fonts

**Files:**
- Create: `web/src/layouts/Default.astro`
- Create: `web/public/arkadiy-ds-link.txt` (notes for self)

The submodule lives at `design-system/arkadiy-ds/`. Astro doesn't auto-publish it; we must either copy the CSS files into `web/public/` at build time or import them via `<link>` paths that Astro resolves.

Simplest path: copy `tokens.css` + `typography.css` into `web/public/arkadiy-ds/` via a small build prep script.

- [ ] **Step 1: Add prep script**

```json
// modify web/package.json scripts
{
  "scripts": {
    "prebuild": "node scripts/copy-ds.mjs",
    "predev": "node scripts/copy-ds.mjs",
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  }
}
```

- [ ] **Step 2: Write the prep script**

```js
// web/scripts/copy-ds.mjs
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../../design-system/arkadiy-ds');
const DST = resolve(__dirname, '../public/arkadiy-ds');

await mkdir(DST, { recursive: true });
await copyFile(`${SRC}/tokens.css`, `${DST}/tokens.css`);
await copyFile(`${SRC}/typography.css`, `${DST}/typography.css`);
console.log('Copied arkadiy-ds tokens.css + typography.css to web/public/arkadiy-ds/');
```

- [ ] **Step 3: Write the layout**

```astro
---
// web/src/layouts/Default.astro
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
}
const { title, description, ogImage } = Astro.props;
const baseHref = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
---
<!doctype html>
<html lang="ru" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    {ogImage && <meta property="og:image" content={ogImage} />}
    <meta property="og:title" content={title} />
    {description && <meta property="og:description" content={description} />}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
    <link rel="stylesheet" href={`${baseHref}/arkadiy-ds/tokens.css`} />
    <link rel="stylesheet" href={`${baseHref}/arkadiy-ds/typography.css`} />
    <style is:global>
      body {
        background: var(--bg);
        color: var(--ink);
        font-family: var(--font-body);
        font-size: var(--body-size, 17px);
        line-height: 1.6;
        margin: 0;
        padding: 0;
      }
      .page {
        max-width: var(--max-width, 1320px);
        margin: 0 auto;
        padding: 0 var(--gutter, 64px);
      }
      figure.fish-figure {
        border: 1px solid var(--rule);
        background: transparent;
        margin: var(--section-pad, 96px) auto;
        padding: 0;
        width: fit-content;
      }
      figure.fish-figure svg { display: block; }
      .fig-label {
        font-family: var(--font-mono);
        font-size: var(--meta-size, 11px);
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--ink-soft);
        margin: 8px 0;
      }
      .concept-card { display: grid; grid-template-columns: 80px 1fr; gap: 8px 16px; margin-top: 16px; }
      .concept-card .label {
        font-family: var(--font-mono);
        font-size: var(--meta-size, 11px);
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--ink-soft);
      }
      .concept-card .value { color: var(--ink); }
      .concept-card .dsl {
        font-family: var(--font-mono);
        font-size: 14px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <slot />
    </div>
  </body>
</html>
```

- [ ] **Step 4: Verify build still works**

```bash
npm run build:web
```

Expected: dist contains `arkadiy-ds/tokens.css` etc.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/copy-ds.mjs web/package.json web/src/layouts/Default.astro
git commit -m "$(cat <<'EOF'
feat(web): default layout loads arkadiy-ds tokens, typography, fonts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.3: Fish loader + components

**Files:**
- Create: `web/src/lib/fish-loader.ts`
- Create: `web/src/components/Fish.astro`
- Create: `web/src/components/ConceptCard.astro`

- [ ] **Step 1: Fish loader (reads from `fish/` at build time)**

```ts
// web/src/lib/fish-loader.ts
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FISH_DIR = resolve(__dirname, '../../../fish');

export interface LoadedFish {
  date: string;
  record: any; // FishRecord; loose-typed at this boundary to avoid pipeline import
  svg: string;
}

export interface LoadedEmptyDay {
  date: string;
  reason: string;
}

export async function listAllDates(): Promise<string[]> {
  if (!existsSync(FISH_DIR)) return [];
  const files = await readdir(FISH_DIR);
  const dates = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.(json|empty\.json)$/);
    if (m) dates.add(m[1]);
  }
  return [...dates].sort().reverse();
}

export async function loadFish(date: string): Promise<LoadedFish | null> {
  const jsonPath = join(FISH_DIR, `${date}.json`);
  const svgPath = join(FISH_DIR, `${date}.svg`);
  if (!existsSync(jsonPath) || !existsSync(svgPath)) return null;
  const record = JSON.parse(await readFile(jsonPath, 'utf-8'));
  const svg = await readFile(svgPath, 'utf-8');
  return { date, record, svg };
}

export async function loadEmptyDay(date: string): Promise<LoadedEmptyDay | null> {
  const path = join(FISH_DIR, `${date}.empty.json`);
  if (!existsSync(path)) return null;
  const r = JSON.parse(await readFile(path, 'utf-8'));
  return { date, reason: r.reason };
}

export async function loadLatest(): Promise<{ kind: 'fish'; data: LoadedFish } | { kind: 'empty'; data: LoadedEmptyDay } | null> {
  const dates = await listAllDates();
  if (dates.length === 0) return null;
  const date = dates[0];
  const fish = await loadFish(date);
  if (fish) return { kind: 'fish', data: fish };
  const empty = await loadEmptyDay(date);
  if (empty) return { kind: 'empty', data: empty };
  return null;
}
```

- [ ] **Step 2: Fish component**

```astro
---
// web/src/components/Fish.astro
interface Props { svg: string; date: string; alt: string; }
const { svg, date, alt } = Astro.props;
---
<figure class="fish-figure" aria-label={alt}>
  <Fragment set:html={svg} />
</figure>
<div class="fig-label">FIG. {date}</div>
```

- [ ] **Step 3: ConceptCard component**

```astro
---
// web/src/components/ConceptCard.astro
import type { Stage1Output, Stage2Output, Stage3Output } from '../../../pipeline/src/storage/storage.ts';
interface Props { stage1: Stage1Output; stage2: Stage2Output; stage3: Stage3Output; }
const { stage1, stage2, stage3 } = Astro.props;

const wordLine = stage1.transliteration
  ? `${stage1.word} (${stage1.language.toLowerCase()}: ${stage1.transliteration} — ${stage1.russian_meaning})`
  : `${stage1.word} (${stage1.language.toLowerCase()}: ${stage1.russian_meaning})`;

const dslLines = (() => {
  const d = stage3.dsl;
  const lines = [`body: ${d.body.primitive} / ${d.body.color} / ${d.body.orientation}`];
  if (d.tail) lines.push(`tail: ${d.tail.primitive} / ${d.tail.color} / ${d.tail.side}`);
  lines.push(`eye: ${d.eye.style} / ${d.eye.position}`);
  if (d.fin_top) lines.push(`fin_top: ${d.fin_top.primitive} / ${d.fin_top.color}`);
  if (d.fin_bottom) lines.push(`fin_bottom: ${d.fin_bottom.primitive} / ${d.fin_bottom.color}`);
  if (d.background_block) {
    const off = `[${d.background_block.offset[0]}, ${d.background_block.offset[1]}]`;
    lines.push(`background_block: ${d.background_block.color} / ${d.background_block.size} / ${off}`);
  }
  for (const a of d.accents) lines.push(`accent: ${a.type} / ${a.color} / ${a.position}`);
  return lines.join('\n');
})();
---
<div class="concept-card">
  <div class="label">Слово</div>  <div class="value">{wordLine}</div>
  <div class="label">Рыба</div>  <div class="value">{stage2.description}</div>
  <div class="label">DSL</div>   <div class="value dsl">{dslLines}</div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/ web/src/components/
git commit -m "$(cat <<'EOF'
feat(web): fish loader + Fish/ConceptCard components

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.4: Pages — today, permalink, archive

**Files:**
- Modify: `web/src/pages/index.astro`
- Create: `web/src/pages/[date].astro`
- Create: `web/src/pages/archive.astro`

- [ ] **Step 1: Today page**

```astro
---
// web/src/pages/index.astro
import Default from '../layouts/Default.astro';
import Fish from '../components/Fish.astro';
import ConceptCard from '../components/ConceptCard.astro';
import { loadLatest } from '../lib/fish-loader.ts';

const latest = await loadLatest();
---
<Default
  title={latest?.kind === 'fish' ? `${latest.data.date} · ${latest.data.record.stage1.word} — Rybov` : 'Rybov'}
  description={latest?.kind === 'fish' ? latest.data.record.stage2.description.slice(0, 200) : 'One concept-art fish per day.'}
>
  {latest === null && <p>Сегодня пока без рыбы.</p>}
  {latest?.kind === 'empty' && (
    <Fragment>
      <h1>Сегодня без рыбы</h1>
      <p class="fig-label">FIG. {latest.data.date}</p>
      <p>{latest.data.reason}</p>
    </Fragment>
  )}
  {latest?.kind === 'fish' && (
    <Fragment>
      <Fish svg={latest.data.svg} date={latest.data.date} alt={`Concept fish for ${latest.data.date}`} />
      <ConceptCard
        stage1={latest.data.record.stage1}
        stage2={latest.data.record.stage2}
        stage3={latest.data.record.stage3}
      />
    </Fragment>
  )}
</Default>
```

- [ ] **Step 2: Permalink page**

```astro
---
// web/src/pages/[date].astro
import Default from '../layouts/Default.astro';
import Fish from '../components/Fish.astro';
import ConceptCard from '../components/ConceptCard.astro';
import { listAllDates, loadFish, loadEmptyDay } from '../lib/fish-loader.ts';

export async function getStaticPaths() {
  const dates = await listAllDates();
  const out = [];
  for (const date of dates) {
    const fish = await loadFish(date);
    const empty = fish ? null : await loadEmptyDay(date);
    out.push({ params: { date }, props: { fish, empty } });
  }
  return out;
}

const { fish, empty } = Astro.props;
const { date } = Astro.params;
---
<Default
  title={fish ? `${date} · ${fish.record.stage1.word} — Rybov` : `${date} — Rybov`}
  description={fish?.record.stage2.description.slice(0, 200)}
>
  {fish && (
    <Fragment>
      <Fish svg={fish.svg} date={date} alt={`Concept fish for ${date}`} />
      <ConceptCard stage1={fish.record.stage1} stage2={fish.record.stage2} stage3={fish.record.stage3} />
    </Fragment>
  )}
  {empty && (
    <Fragment>
      <h1>{date} — Без рыбы</h1>
      <p>{empty.reason}</p>
    </Fragment>
  )}
</Default>
```

- [ ] **Step 3: Archive page**

```astro
---
// web/src/pages/archive.astro
import Default from '../layouts/Default.astro';
import { listAllDates, loadFish, loadEmptyDay } from '../lib/fish-loader.ts';

const dates = await listAllDates();
const items = [];
for (const date of dates) {
  const fish = await loadFish(date);
  if (fish) items.push({ date, kind: 'fish' as const, word: fish.record.stage1.word });
  else {
    const e = await loadEmptyDay(date);
    if (e) items.push({ date, kind: 'empty' as const, word: '—' });
  }
}
const baseHref = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
---
<Default title="Архив — Rybov" description="Все рыбы, по дате">
  <h1>Архив</h1>
  <ul style="list-style:none;padding:0;margin:0">
    {items.map((it) => (
      <li style="padding:8px 0;border-bottom:1px solid var(--rule);display:flex;gap:24px">
        <a href={`${baseHref}/${it.date}`} class="fig-label" style="text-decoration:none">{it.date}</a>
        <span>{it.kind === 'empty' ? '— без рыбы' : it.word}</span>
      </li>
    ))}
  </ul>
</Default>
```

- [ ] **Step 4: Build + spot-check**

```bash
npm run build:web
```

Expected: `web/dist/index.html`, `web/dist/<date>.html` files for any fish in `fish/`, and `web/dist/archive.html`.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/
git commit -m "$(cat <<'EOF'
feat(web): today + permalink + archive pages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.5: Embed arkadiy-ds topbar + footer

Per spec §4.5, page chrome must include the Euler wordmark topbar and footer from `design-system/arkadiy-ds/components/`. These are portable HTML templates with placeholder strings.

**Files:**
- Create: `web/src/components/Topbar.astro`
- Create: `web/src/components/Footer.astro`
- Modify: `web/src/layouts/Default.astro` (mount Topbar + Footer in body)

- [ ] **Step 1: Read the source components**

```bash
cat design-system/arkadiy-ds/components/topbar.html
cat design-system/arkadiy-ds/components/footer.html
```

These contain: HTML markup, inline `<style>` blocks scoped to the component classes, and an inline `<script>` for theme toggle (in topbar.html). Identify placeholder strings (typically `{{PROJECT_NAME}}`, `{{LINKS}}`, etc.).

- [ ] **Step 2: Port topbar.html to Astro component**

Copy the full HTML/CSS/JS contents into `Topbar.astro`. Replace placeholders with project-specific values (or accept them as Astro `Props`).

```astro
---
// web/src/components/Topbar.astro
// Source: design-system/arkadiy-ds/components/topbar.html
// Replace {{PROJECT_NAME}} → "Rybov"
// Replace {{LINKS}} → archive link
interface Props {
  projectName?: string;
  archiveHref: string;
}
const { projectName = 'Rybov', archiveHref } = Astro.props;
---
{/*
  Paste the full <header>...</header> markup from topbar.html here,
  with placeholder substitutions:
    - Project name slot → {projectName}
    - Nav links slot → <a href={archiveHref}>Архив</a>
  Keep the inline <style> and <script> blocks as <style> and <script> in the .astro file.
  (Astro keeps inline <script> client-side by default; topbar's theme toggle is a tiny IIFE
   that reads localStorage and sets data-theme on <html>.)
*/}
```

- [ ] **Step 3: Port footer.html to Astro component**

```astro
---
// web/src/components/Footer.astro
// Source: design-system/arkadiy-ds/components/footer.html
// Replace {{COLUMNS}} placeholders with project-specific link sets, or pass as props.
---
{/*
  Paste the full <footer>...</footer> markup from footer.html here,
  with placeholder substitutions appropriate to Rybov.
  At minimum: a single column linking to GitHub repo + the Telegram channel.
*/}
```

- [ ] **Step 4: Mount in Default layout**

```diff
// web/src/layouts/Default.astro
---
+import Topbar from '../components/Topbar.astro';
+import Footer from '../components/Footer.astro';
 interface Props { ... }
 const { title, description, ogImage } = Astro.props;
 const baseHref = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
+const archiveHref = `${baseHref}/archive`;
---
 <!doctype html>
 <html lang="ru" data-theme="dark">
   <head>...</head>
   <body>
+    <Topbar archiveHref={archiveHref} />
     <div class="page">
       <slot />
     </div>
+    <Footer />
   </body>
 </html>
```

- [ ] **Step 5: Verify build + visual check**

```bash
npm run build:web
npm run preview --workspace web   # serves the built site
```

Open the local preview, confirm:
- Topbar with Euler `eⁱπ + 1 = 0` in center, AS monogram on left
- Theme toggle works (clicking switches dark↔light, persists to localStorage)
- Footer renders without layout breaks
- Archive link in topbar nav resolves correctly

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Topbar.astro web/src/components/Footer.astro web/src/layouts/Default.astro
git commit -m "$(cat <<'EOF'
feat(web): embed arkadiy-ds topbar (Euler + AS) and footer

Ports topbar.html and footer.html as Astro components, mounted in
Default layout. Theme toggle (dark↔light, localStorage canonical)
inherited from topbar source unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9 — Telegram Delivery

### Task 9.1: SVG → PNG converter

**Files:**
- Create: `pipeline/src/delivery/png.ts`
- Create: `pipeline/tests/delivery/png.test.ts`

- [ ] **Step 1: Test**

```ts
// pipeline/tests/delivery/png.test.ts
import { describe, expect, it } from 'vitest';
import { svgToPng } from '../../src/delivery/png.ts';

describe('svgToPng', () => {
  it('converts a basic SVG to a PNG buffer (PNG magic bytes)', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="200" height="140"><rect width="200" height="140" fill="#FAFAFA"/></svg>';
    const buf = await svgToPng(svg);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // P
    expect(buf[2]).toBe(0x4e); // N
    expect(buf[3]).toBe(0x47); // G
  });
});
```

- [ ] **Step 2: Implement**

```ts
// pipeline/src/delivery/png.ts
import { Resvg } from '@resvg/resvg-js';

export async function svgToPng(svg: string, scale = 4): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
  });
  return Buffer.from(resvg.render().asPng());
}
```

- [ ] **Step 3: Run — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/delivery/png.ts pipeline/tests/delivery/png.test.ts
git commit -m "$(cat <<'EOF'
feat(delivery): SVG → PNG via @resvg/resvg-js for TG previews

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9.2: Telegram bot post

**Files:**
- Create: `pipeline/src/delivery/telegram.ts`
- Create: `pipeline/src/scripts/post-tg.ts`

- [ ] **Step 1: Implement**

```ts
// pipeline/src/delivery/telegram.ts
const TG_API = 'https://api.telegram.org';

export interface TgPostInput {
  botToken: string;
  channelId: string; // e.g. "@rybov_show" or numeric "-1001234567890"
  caption: string;
  imagePng: Buffer;
}

export async function postFishToTelegram(input: TgPostInput): Promise<void> {
  const url = `${TG_API}/bot${input.botToken}/sendPhoto`;
  const form = new FormData();
  form.append('chat_id', input.channelId);
  form.append('caption', input.caption);
  form.append('parse_mode', 'HTML');
  form.append('photo', new Blob([input.imagePng], { type: 'image/png' }), 'fish.png');

  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendPhoto ${res.status}: ${body}`);
  }
}

export function buildCaption(args: {
  date: string;
  word: string;
  language: string;
  meaning: string;
  description: string;
  permalinkUrl: string;
}): string {
  const { date, word, language, meaning, description, permalinkUrl } = args;
  // HTML-safe minimum: TG accepts &lt; / &gt; / &amp; / &quot; in HTML mode
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    `<b>FIG. ${esc(date)}</b>`,
    '',
    `<b>Слово</b>: ${esc(word)} (${esc(language.toLowerCase())}: ${esc(meaning)})`,
    `<b>Рыба</b>: ${esc(description)}`,
    '',
    `<a href="${esc(permalinkUrl)}">${esc(permalinkUrl)}</a>`,
  ].join('\n');
}
```

- [ ] **Step 2: Standalone post script**

```ts
// pipeline/src/scripts/post-tg.ts
import { readFish } from '../storage/storage.ts';
import { FISH_DIR } from '../storage/paths.ts';
import { svgToPng } from '../delivery/png.ts';
import { postFishToTelegram, buildCaption } from '../delivery/telegram.ts';
import { todayUtc } from '../shared/dates.ts';

const date = process.argv[2] ?? todayUtc();
const baseUrl = process.env.RYBOV_SITE_URL && process.env.RYBOV_BASE_PATH
  ? `${process.env.RYBOV_SITE_URL}${process.env.RYBOV_BASE_PATH.replace(/\/$/, '')}`
  : 'https://hedgeinform.example/rybov_show';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;
if (!botToken || !channelId) {
  console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID must be set');
  process.exit(1);
}

const result = await readFish(FISH_DIR, date);
if (!result) {
  console.error(`No fish for ${date}`);
  process.exit(1);
}

const png = await svgToPng(result.svg);
const caption = buildCaption({
  date,
  word: result.record.stage1.word,
  language: result.record.stage1.language,
  meaning: result.record.stage1.russian_meaning,
  description: result.record.stage2.description,
  permalinkUrl: `${baseUrl}/${date}`,
});

await postFishToTelegram({ botToken, channelId, caption, imagePng: png });
console.log(`Posted ${date} to ${channelId}`);
```

- [ ] **Step 3: Add to root scripts**

```json
// modify root package.json scripts (append)
{
  "scripts": {
    "post-tg": "node --env-file=.env pipeline/src/scripts/post-tg.ts"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/delivery/telegram.ts pipeline/src/scripts/post-tg.ts package.json
git commit -m "$(cat <<'EOF'
feat(delivery): Telegram channel post via raw Bot API

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9.3: TG smoke test (manual)

**Prerequisites:**
1. Create a Telegram bot via [@BotFather](https://t.me/BotFather), copy token
2. Create a Telegram channel (private or public), add the bot as administrator with "Post Messages" permission
3. Get the channel ID:
   - For public channels: `@channel_username`
   - For private channels: forward a message to [@RawDataBot](https://t.me/raw_data_bot) and copy `forward_from_chat.id`
4. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID` to `.env`

- [ ] **Step 1: Generate a fish (if not already present)**

```bash
npm run daily   # writes to fish/<today>.json + .svg
```

If the cost of a real Opus call is undesirable for a smoke test, manually copy a fish from elsewhere or run dry-run and copy from `/tmp` to `fish/`.

- [ ] **Step 2: Post it**

```bash
npm run post-tg
```

Expected output: `Posted 2026-04-25 to @rybov_show` (or similar).

- [ ] **Step 3: Verify in Telegram**

Open the channel, confirm the post arrived with the PNG image and HTML caption.

(No commit — this is a manual verification step.)

---

## Phase 10 — Automation

### Task 10.1: Daily cron workflow

**Files:**
- Create: `.github/workflows/daily-fish.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/daily-fish.yml
name: Daily fish

on:
  schedule:
    # 00:05 UTC every day (5-min buffer past midnight to avoid rate-limit edge cases)
    - cron: '5 0 * * *'
  workflow_dispatch:
    # manual trigger for backfills / debugging

permissions:
  contents: write   # to commit fish/<date>.json + .svg back to repo

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 1
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - name: Run daily fish
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npm run daily
      - name: Commit + push
        run: |
          git config user.name "rybov-bot"
          git config user.email "rybov-bot@users.noreply.github.com"
          git add fish/
          git diff --staged --quiet || git commit -m "fish: $(date -u +%Y-%m-%d)"
          git push
      - name: Post to Telegram
        if: success()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHANNEL_ID: ${{ secrets.TELEGRAM_CHANNEL_ID }}
          RYBOV_SITE_URL: ${{ vars.RYBOV_SITE_URL }}
          RYBOV_BASE_PATH: ${{ vars.RYBOV_BASE_PATH }}
        run: npm run post-tg
```

Note: when `npm run daily` writes an empty-day record, the commit step still runs (the empty marker is committed). The TG post step runs, but `post-tg` will exit 1 because there's no fish for today. That's intentional — TG silence on empty days is a feature.

Refinement: tighten `post-tg` to handle the empty-day case explicitly (skip silently). See Task 10.1a.

- [ ] **Step 2 (Task 10.1a): Make `post-tg` empty-day-aware**

Modify `pipeline/src/scripts/post-tg.ts` — change the `No fish for ${date}` branch to exit 0:

```ts
// modify pipeline/src/scripts/post-tg.ts (the "No fish" branch)
if (!result) {
  console.log(`No fish for ${date} (likely empty-day); skipping TG post.`);
  process.exit(0);
}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/daily-fish.yml pipeline/src/scripts/post-tg.ts
git commit -m "$(cat <<'EOF'
ci: daily fish workflow with commit + TG post + empty-day skip

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10.2: Web deploy workflow

**Files:**
- Create: `.github/workflows/deploy-web.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/deploy-web.yml
name: Deploy web

on:
  push:
    branches: [master]
    paths:
      - 'fish/**'
      - 'web/**'
      - 'design-system/**'
      - 'package.json'
      - 'package-lock.json'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - name: Build Astro
        env:
          RYBOV_SITE_URL: ${{ vars.RYBOV_SITE_URL || 'https://hedgeinform.github.io' }}
          RYBOV_BASE_PATH: ${{ vars.RYBOV_BASE_PATH || '/rybov' }}
        run: npm run build:web
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-web.yml
git commit -m "$(cat <<'EOF'
ci: GitHub Pages deploy workflow with submodule + Astro build

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10.3: Repo settings + secrets (manual)

This task is operational — no code, but **must be completed before the workflows can run**.

- [ ] **Step 1: Enable GitHub Pages**

In `https://github.com/Hedgeinform/rybov/settings/pages`:
- Source: **GitHub Actions** (not "Deploy from a branch")

- [ ] **Step 2: Set repository secrets**

In `https://github.com/Hedgeinform/rybov/settings/secrets/actions`:
- `OPENROUTER_API_KEY` — the project-specific key
- `TELEGRAM_BOT_TOKEN` — from BotFather
- `TELEGRAM_CHANNEL_ID` — `@rybov_show` or numeric

- [ ] **Step 3: Set repository variables**

In `https://github.com/Hedgeinform/rybov/settings/variables/actions`:
- `RYBOV_SITE_URL` — e.g. `https://hedgeinform.github.io` (or final hostname when set)
- `RYBOV_BASE_PATH` — e.g. `/rybov` (must match repo name for default Pages URL)

- [ ] **Step 4: Test the workflow manually**

In `https://github.com/Hedgeinform/rybov/actions`:
- Run `Daily fish` via "Run workflow" button
- Verify it succeeds and a new commit appears on `master`
- Verify `Deploy web` runs after the fish commit and the site is live

(No git commit for this task — settings live in GitHub UI.)

---

## Phase 11 — README + Final

### Task 11.1: Write README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# Rybov

One concept-art fish per day.

Each day at 00:05 UTC, a 3-stage Claude Opus 4.7 chain (via OpenRouter) generates a single fish:
1. picks a word in any language,
2. imagines a fish from that word (no symbolism, just visual),
3. translates the description into DSL parameters,
which are then rendered to SVG by a procedural engine in constructivist style. The fish is committed to the repo, the static site rebuilds, and a Telegram post goes out.

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

npm test                 # pipeline unit tests
npm run verify:openrouter   # one-time: verify reasoning/caching pass-through
npm run dry-run             # full pipeline to a temp dir
npm run dev:web             # local Astro dev server
```

## License

Private project. All rights reserved.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add README

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11.2: First real fish — end-to-end

- [ ] **Step 1: Push everything to GitHub**

```bash
git push
```

- [ ] **Step 2: Manually trigger `Daily fish` workflow**

Via the GitHub Actions UI (Task 10.3 Step 4).

- [ ] **Step 3: Verify**

- A new commit `fish: YYYY-MM-DD` appears on master
- `fish/YYYY-MM-DD.json` + `.svg` are in the repo
- The `Deploy web` workflow ran after the fish commit
- The Pages site shows the new fish at `/` and `/YYYY-MM-DD`
- A new post appears in `@rybov_show` Telegram channel
- The post links to the canonical URL and the link works

If anything fails — check the workflow logs, fix, push, re-trigger.

(No git commit for this task — it's the launch verification.)

---

## Self-Review (run after the plan executor finishes)

This is a checklist for the executor (not pre-execution). It mirrors the `superpowers:writing-plans` self-review pattern:

1. **Spec coverage:**
   - DSL ✓ (Phase 2) · Renderer ✓ (Phase 3) · Storage ✓ (Phase 4) · Publishing ✓ (Phase 5)
   - LLM 3-stage chain ✓ (Phase 6) · Pipeline ✓ (Phase 7) · Web ✓ (Phase 8)
   - TG ✓ (Phase 9) · Cron + deploy ✓ (Phase 10)
   - arkadiy-ds integration ✓ (Phase 8.2 tokens/fonts + 8.5 topbar/footer) · OpenRouter verification ✓ (Phase 1)
   - Anti-repeat words ✓ (Phase 4.3) · DSL signature observability ✓ (Phase 2.3 + Phase 7.1 record assembly)
   - Empty-day = first-class artifact ✓ (Phase 4.2 + Phase 7.1)
   - Renderer/model versioning stamps ✓ (Phase 7.1 record)

2. **Placeholder scan:** No `TBD`, `TODO`, or "implement appropriate X" remain in any task body.

3. **Type/name consistency:** `FishRecord`, `EmptyDayRecord`, `Stage1Output/2/3`, `DSL`, `Signature`, `CanonicalFish` are defined once and re-used. `RENDERER_VERSION`, `MODEL`, `FISH_DIR` are single-source constants.

4. **Ambiguity scan:** Each task has exact files, exact code, exact commands.
