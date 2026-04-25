import { describe, expect, it } from 'vitest';
import { RYBOV_VERSION } from '../src/shared/types.ts';

describe('sanity', () => {
  it('exports a version constant', () => {
    expect(RYBOV_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
