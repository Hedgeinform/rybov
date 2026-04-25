import type { DSL, Primitive, Color } from './schema.ts';

export interface Signature {
  body_primitive: Primitive;
  body_color: Color;
  has_bg_block: boolean;
  bg_color: Color | null;
  has_tail: boolean;
}

export function computeSignature(dsl: DSL): Signature {
  return {
    body_primitive: dsl.body.primitive,
    body_color: dsl.body.color,
    has_bg_block: dsl.background_block !== null,
    bg_color: dsl.background_block?.color ?? null,
    has_tail: dsl.tail !== null,
  };
}
