import type { DSL } from '../dsl/schema.ts';
import {
  renderBody, renderTail, renderFin, renderEye,
  renderBackgroundBlock, renderAccent,
} from './primitives.ts';
import { FISH_CANVAS_BG, VIEWBOX } from './palette.ts';

export function render(dsl: DSL): string {
  const parts: string[] = [];

  // 1. Intrinsic canvas always first (when bg_block is offset, edges still need fill)
  parts.push(`<rect x="0" y="0" width="${VIEWBOX.w}" height="${VIEWBOX.h}" fill="${FISH_CANVAS_BG}"/>`);

  // 2. Background block (if any) sits on top of the canvas, behind everything else
  if (dsl.background_block) {
    parts.push(renderBackgroundBlock(dsl.background_block));
  }

  // 3. Accents go behind body for compositional layering
  for (const a of dsl.accents) parts.push(renderAccent(a));

  // 4. Body
  parts.push(renderBody(dsl.body));

  // 5. Tail (sits behind body visually but rendered after for the join illusion)
  if (dsl.tail) parts.push(renderTail(dsl.tail));

  // 6. Fins
  if (dsl.fin_top) parts.push(renderFin(dsl.fin_top, 'top'));
  if (dsl.fin_bottom) parts.push(renderFin(dsl.fin_bottom, 'bottom'));

  // 7. Eye (always on top)
  parts.push(renderEye(dsl.eye));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" width="${VIEWBOX.w}" height="${VIEWBOX.h}">${parts.join('')}</svg>`;
}
