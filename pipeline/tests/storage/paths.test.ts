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
