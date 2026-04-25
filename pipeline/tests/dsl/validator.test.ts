import { describe, expect, it } from 'vitest';
import { validate } from '../../src/dsl/validator.ts';
import type { DSL } from '../../src/dsl/schema.ts';

const baseFish: DSL = {
  body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
  head: null,
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
      fin_top: { primitive: 'triangle', color: 'yellow', tilt: 'perpendicular' },
      fin_bottom: { primitive: 'triangle', color: 'accent_cyan', tilt: 'perpendicular' },
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
      background_block: { color: 'fuchsia', size: 'small', offset: [0, 0] },
    })).toThrow();
  });

  it('rejects head_* eye position when head is null', () => {
    const fish: DSL = { ...baseFish, head: null, eye: { style: 'dot', position: 'head_center' } };
    const r = validate(fish);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/head_.*null/i);
  });

  it('rejects body-front eye position when head is present', () => {
    const fish: DSL = {
      ...baseFish,
      head: { primitive: 'circle', color: 'red' },
      eye: { style: 'dot', position: 'front_top' },
    };
    const r = validate(fish);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/head_top.*head_center.*head_bottom/i);
  });

  it('accepts head present + eye on head', () => {
    const fish: DSL = {
      ...baseFish,
      head: { primitive: 'circle', color: 'red' },
      eye: { style: 'dot', position: 'head_center' },
    };
    expect(validate(fish).ok).toBe(true);
  });
});
