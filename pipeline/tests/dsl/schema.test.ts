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
