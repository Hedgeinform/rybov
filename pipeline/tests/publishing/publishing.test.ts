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
