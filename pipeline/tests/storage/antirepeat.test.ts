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
