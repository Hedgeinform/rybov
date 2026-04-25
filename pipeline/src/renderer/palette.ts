import type { Color } from '../dsl/schema.ts';

const PALETTE: Record<Color, string> = {
  red: '#A02C5B',
  blue: '#3D2E8C',
  yellow: '#C8A435',
  black: '#111111',
  white: '#FAFAFA',
  accent_cyan: '#2E8B7F',
  accent_ochre: '#6B7A2F',
  accent_deep_red: '#5D2A6E',
};

export function hex(c: Color): string {
  return PALETTE[c];
}

export const FISH_CANVAS_BG = '#FAFAFA';
export const VIEWBOX = { w: 200, h: 140 } as const;
export const STROKE_CONTOUR = 2;
export const STROKE_ACCENT = 2.5;
