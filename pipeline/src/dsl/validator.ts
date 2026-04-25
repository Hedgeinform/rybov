import { DSLSchema, type DSL, type Color } from './schema.ts';

export type ValidationResult =
  | { ok: true; dsl: DSL }
  | { ok: false; error: string };

const HEAD_POSITIONS = new Set(['head_top', 'head_center', 'head_bottom']);

export function validate(input: unknown): ValidationResult {
  const parsed = DSLSchema.parse(input);

  // Constraint 1: distinct colors ≤ 4
  const colors = new Set<Color>();
  colors.add(parsed.body.color);
  if (parsed.head) colors.add(parsed.head.color);
  if (parsed.tail) colors.add(parsed.tail.color);
  if (parsed.fin_top) colors.add(parsed.fin_top.color);
  if (parsed.fin_bottom) colors.add(parsed.fin_bottom.color);
  if (parsed.background_block) colors.add(parsed.background_block.color);
  for (const a of parsed.accents) colors.add(a.color);
  if (colors.size > 4) {
    return { ok: false, error: `Too many distinct colors (${colors.size}); max 4 allowed` };
  }

  // Constraint 2: tail.side opposite to body.orientation
  if (parsed.tail && parsed.tail.side === parsed.body.orientation) {
    return {
      ok: false,
      error: `tail.side must be opposite to body.orientation (body=${parsed.body.orientation}, tail.side=${parsed.tail.side})`,
    };
  }

  // Constraint 3: eye position must agree with head presence
  const eyeOnHead = HEAD_POSITIONS.has(parsed.eye.position);
  if (parsed.head && !eyeOnHead) {
    return {
      ok: false,
      error: `eye.position must be one of head_top|head_center|head_bottom when head is present (got ${parsed.eye.position})`,
    };
  }
  if (!parsed.head && eyeOnHead) {
    return {
      ok: false,
      error: `eye.position must NOT be a head_* position when head is null (got ${parsed.eye.position})`,
    };
  }

  return { ok: true, dsl: parsed };
}
