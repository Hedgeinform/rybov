import type { DSL, Primitive, HeadPrimitive, TailPrimitive, Color } from './schema.ts';

export interface Signature {
  body_primitive: Primitive;
  body_color: Color;
  head_primitive: HeadPrimitive | null;
  has_bg_block: boolean;
  bg_color: Color | null;
  has_tail: boolean;
  tail_primitive: TailPrimitive | null;
}

export function computeSignature(dsl: DSL): Signature {
  return {
    body_primitive: dsl.body.primitive,
    body_color: dsl.body.color,
    head_primitive: dsl.head?.primitive ?? null,
    has_bg_block: dsl.background_block !== null,
    bg_color: dsl.background_block?.color ?? null,
    has_tail: dsl.tail !== null,
    tail_primitive: dsl.tail?.primitive ?? null,
  };
}
