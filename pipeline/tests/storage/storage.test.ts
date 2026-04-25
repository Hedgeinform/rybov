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
