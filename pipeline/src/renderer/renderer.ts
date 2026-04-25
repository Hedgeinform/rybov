import type { DSL } from '../dsl/schema.ts';
import {
  renderBody, renderHead, renderTail, renderFin, renderEye,
  renderBackgroundBlock, renderAccent,
} from './primitives.ts';
import { FISH_CANVAS_BG, VIEWBOX } from './palette.ts';

export function render(dsl: DSL): string {
  const parts: string[] = [];

  parts.push(`<rect x="0" y="0" width="${VIEWBOX.w}" height="${VIEWBOX.h}" fill="${FISH_CANVAS_BG}"/>`);

  if (dsl.background_block) {
    parts.push(renderBackgroundBlock(dsl.background_block));
  }

  for (const a of dsl.accents) parts.push(renderAccent(a));

  parts.push(renderBody(dsl.body));

  if (dsl.tail) parts.push(renderTail(dsl.tail));

  if (dsl.head) {
    parts.push(renderHead({ ...dsl.head, orientation: dsl.body.orientation }));
  }

  if (dsl.fin_top) parts.push(renderFin(dsl.fin_top, 'top', dsl.body.orientation));
  if (dsl.fin_bottom) parts.push(renderFin(dsl.fin_bottom, 'bottom', dsl.body.orientation));

  parts.push(renderEye({
    ...dsl.eye,
    hasHead: dsl.head !== null,
    bodyOrientation: dsl.body.orientation,
  }));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" width="${VIEWBOX.w}" height="${VIEWBOX.h}">${parts.join('')}</svg>`;
}
