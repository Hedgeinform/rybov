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
