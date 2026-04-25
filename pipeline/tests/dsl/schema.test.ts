import { describe, expect, it } from 'vitest';
import {
  DSLSchema, COLORS, PRIMITIVES, POSITIONS,
  HEAD_PRIMITIVES, TAIL_PRIMITIVES, FIN_TILTS,
} from '../../src/dsl/schema.ts';

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
  it('exposes the closed position set including head positions', () => {
    expect(POSITIONS).toContain('front_top');
    expect(POSITIONS).toContain('midline');
    expect(POSITIONS).toContain('head_top');
    expect(POSITIONS).toContain('head_center');
    expect(POSITIONS).toContain('head_bottom');
  });
  it('exposes the head, tail, and fin tilt enums', () => {
    expect(HEAD_PRIMITIVES).toEqual(['circle', 'oval', 'triangle']);
    expect(TAIL_PRIMITIVES).toEqual(['triangle', 'rectangle', 'arrow', 'fork']);
    expect(FIN_TILTS).toEqual(['perpendicular', 'tilted_forward', 'tilted_backward']);
  });
});

describe('DSLSchema parse', () => {
  it('accepts a minimal valid DSL (no head)', () => {
    const dsl = {
      body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
      head: null,
      eye: { style: 'double_circle', position: 'front_top' },
      tail: null,
      fin_top: null,
      fin_bottom: null,
      background_block: null,
      accents: [],
    };
    expect(DSLSchema.parse(dsl)).toEqual(dsl);
  });

  it('accepts a DSL with head + arrow tail + tilted fin', () => {
    const dsl = {
      body: { primitive: 'rectangle', orientation: 'right', color: 'blue' },
      head: { primitive: 'triangle', color: 'red' },
      eye: { style: 'dot', position: 'head_center' },
      tail: { primitive: 'arrow', color: 'yellow', side: 'left' },
      fin_top: { primitive: 'triangle', color: 'black', tilt: 'tilted_forward' },
      fin_bottom: null,
      background_block: null,
      accents: [],
    };
    expect(DSLSchema.parse(dsl)).toEqual(dsl);
  });

  it('rejects an invalid color', () => {
    expect(() => DSLSchema.parse({
      body: { primitive: 'ellipse', orientation: 'right', color: 'turquoise' },
      head: null,
      eye: { style: 'double_circle', position: 'front_top' },
      tail: null, fin_top: null, fin_bottom: null,
      background_block: null, accents: [],
    })).toThrow();
  });

  it('rejects an invalid tail primitive (body primitive is not a tail primitive)', () => {
    expect(() => DSLSchema.parse({
      body: { primitive: 'ellipse', orientation: 'right', color: 'blue' },
      head: null,
      eye: { style: 'dot', position: 'front_top' },
      tail: { primitive: 'ellipse', color: 'red', side: 'left' },
      fin_top: null, fin_bottom: null,
      background_block: null, accents: [],
    })).toThrow();
  });
});
