import type { Color } from '../dsl/schema.ts';

const PALETTE: Record<Color, string> = {
  red: '#D32F2F',
  blue: '#1E5BCC',
  yellow: '#F5C518',
  black: '#111111',
  white: '#FAFAFA',
  accent_cyan: '#2A9DC9',
  accent_ochre: '#B8862E',
  accent_deep_red: '#8A1F1F',
};

export function hex(c: Color): string {
  return PALETTE[c];
}

export const FISH_CANVAS_BG = '#FAFAFA';
export const VIEWBOX = { w: 200, h: 140 } as const;
export const STROKE_CONTOUR = 2;
export const STROKE_ACCENT = 2.5;
