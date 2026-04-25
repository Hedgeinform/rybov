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
    expect(() => validate({
      ...baseFish,
      // @ts-expect-error invalid color
      background_block: { color: 'fuchsia', size: 'small', offset: [0, 0] },
    })).toThrow();
  });
});
