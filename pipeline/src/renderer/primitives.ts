import { hex, VIEWBOX } from './palette.ts';
import type { Color, Primitive, Orientation } from './schema-helpers.ts';

export type RenderColor = Color;
export type RenderPrimitive = Primitive;
export type RenderOrientation = Orientation;

const CX = VIEWBOX.w / 2;     // 100
const CY = VIEWBOX.h / 2;     // 70
const BODY_W = 110;
const BODY_H = 60;

interface BodyParams {
  primitive: RenderPrimitive;
  orientation: RenderOrientation;
  color: RenderColor;
}

export function renderBody({ primitive, orientation, color }: BodyParams): string {
  const fill = hex(color);
  const left = CX - BODY_W / 2;
  const right = CX + BODY_W / 2;
  const top = CY - BODY_H / 2;
  const bottom = CY + BODY_H / 2;

  switch (primitive) {
    case 'triangle': {
      const tip = orientation === 'right' ? right : left;
      const baseX = orientation === 'right' ? left : right;
      return `<polygon points="${tip},${CY} ${baseX},${top} ${baseX},${bottom}" fill="${fill}"/>`;
    }
    case 'ellipse': {
      const rx = BODY_W / 2;
      const ry = BODY_H / 2;
      return `<ellipse cx="${CX}" cy="${CY}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
    }
    case 'rectangle': {
      return `<rect x="${left}" y="${top}" width="${BODY_W}" height="${BODY_H}" fill="${fill}"/>`;
    }
    case 'semicircle': {
      const r = BODY_H / 2;
      const flatX = orientation === 'right' ? right - r : left + r;
      const sweep = orientation === 'right' ? 0 : 1;
      return `<path d="M ${flatX} ${top} A ${r} ${r} 0 0 ${sweep} ${flatX} ${bottom} Z" fill="${fill}"/>`;
    }
    case 'composite_two_triangles': {
      const tip = orientation === 'right' ? right : left;
      const baseX = orientation === 'right' ? left : right;
      return [
        `<polygon points="${tip},${top} ${baseX},${CY} ${tip},${CY}" fill="${fill}"/>`,
        `<polygon points="${tip},${CY} ${baseX},${CY} ${tip},${bottom}" fill="${fill}"/>`,
      ].join('');
    }
    case 'semicircle_with_triangle': {
      const r = BODY_H / 2;
      const flatX = orientation === 'right' ? right - r : left + r;
      const sweep = orientation === 'right' ? 0 : 1;
      const triTip = orientation === 'right' ? left : right;
      return [
        `<path d="M ${flatX} ${top} A ${r} ${r} 0 0 ${sweep} ${flatX} ${bottom} Z" fill="${fill}"/>`,
        `<polygon points="${flatX},${top} ${triTip},${CY} ${flatX},${bottom}" fill="${fill}"/>`,
      ].join('');
    }
  }
}

const TAIL_W = 35;
const TAIL_H = 60;

interface TailParams { primitive: RenderPrimitive; color: RenderColor; side: RenderOrientation; }
export function renderTail({ primitive, color, side }: TailParams): string {
  const fill = hex(color);
  const baseX = side === 'left' ? CX - BODY_W / 2 : CX + BODY_W / 2;
  const tipX = side === 'left' ? baseX - TAIL_W : baseX + TAIL_W;
  const top = CY - TAIL_H / 2;
  const bottom = CY + TAIL_H / 2;

  switch (primitive) {
    case 'triangle':
      return `<polygon points="${baseX},${CY} ${tipX},${top} ${tipX},${bottom}" fill="${fill}"/>`;
    case 'rectangle':
      return `<rect x="${Math.min(baseX, tipX)}" y="${top}" width="${TAIL_W}" height="${TAIL_H}" fill="${fill}"/>`;
    default:
      return `<polygon points="${baseX},${CY} ${tipX},${top} ${tipX},${bottom}" fill="${fill}"/>`;
  }
}

const FIN_SIZE = 20;
interface FinParams { primitive: RenderPrimitive; color: RenderColor; }
export function renderFin({ color }: FinParams, where: 'top' | 'bottom'): string {
  const fill = hex(color);
  const baseY = where === 'top' ? CY - BODY_H / 2 : CY + BODY_H / 2;
  const tipY = where === 'top' ? baseY - FIN_SIZE : baseY + FIN_SIZE;
  const x1 = CX - FIN_SIZE / 2;
  const x2 = CX + FIN_SIZE / 2;
  return `<polygon points="${x1},${baseY} ${x2},${baseY} ${CX},${tipY}" fill="${fill}"/>`;
}

interface EyeParams { style: 'double_circle' | 'dot' | 'circle' | 'square'; position: string; }
export function renderEye({ style, position }: EyeParams): string {
  const eyeX = CX + 35;
  const eyeY = position === 'front_top' ? CY - 12
            : position === 'front_low' ? CY + 12
            : CY;

  const outerR = 9;
  const innerR = 3.5;

  switch (style) {
    case 'double_circle':
      return [
        `<circle cx="${eyeX}" cy="${eyeY}" r="${outerR}" fill="#FAFAFA" stroke="#111111" stroke-width="2"/>`,
        `<circle cx="${eyeX}" cy="${eyeY}" r="${innerR}" fill="#111111"/>`,
      ].join('');
    case 'dot':
      return `<circle cx="${eyeX}" cy="${eyeY}" r="${innerR}" fill="#111111"/>`;
    case 'circle':
      return `<circle cx="${eyeX}" cy="${eyeY}" r="${outerR}" fill="none" stroke="#111111" stroke-width="2"/>`;
    case 'square':
      return `<rect x="${eyeX - outerR}" y="${eyeY - outerR}" width="${outerR * 2}" height="${outerR * 2}" fill="#111111"/>`;
  }
}

const BLOCK_SIZES = { small: { w: 80, h: 60 }, medium: { w: 100, h: 80 }, large: { w: 130, h: 100 } } as const;

interface BgBlockParams { color: RenderColor; size: 'small' | 'medium' | 'large'; offset: [number, number]; }
export function renderBackgroundBlock({ color, size, offset }: BgBlockParams): string {
  const fill = hex(color);
  const dim = BLOCK_SIZES[size];
  const x = (VIEWBOX.w - dim.w) / 2 + offset[0];
  const y = (VIEWBOX.h - dim.h) / 2 + offset[1];
  return `<rect x="${x}" y="${y}" width="${dim.w}" height="${dim.h}" fill="${fill}"/>`;
}

interface AccentParams { type: string; color: RenderColor; position: string; }
export function renderAccent({ type, color, position }: AccentParams): string {
  const stroke = hex(color);
  const yMap: Record<string, number> = {
    midline: CY, low: CY + 18, front_top: CY - 18, front_center: CY,
    front_low: CY + 12, head_top: CY - 25, head_bottom: CY + 25,
    tail_side: CY,
  };
  const y = yMap[position] ?? CY;

  switch (type) {
    case 'horizontal_line':
      return `<line x1="${CX - BODY_W / 2 + 5}" y1="${y}" x2="${CX + BODY_W / 2 - 5}" y2="${y}" stroke="${stroke}" stroke-width="2.5"/>`;
    case 'horizontal_band':
      return `<rect x="${CX - BODY_W / 2}" y="${y - 7}" width="${BODY_W}" height="14" fill="${stroke}"/>`;
    case 'dot':
      return `<circle cx="${CX}" cy="${y}" r="3" fill="${stroke}"/>`;
    case 'small_triangle':
      return `<polygon points="${CX - 5},${y + 5} ${CX + 5},${y + 5} ${CX},${y - 5}" fill="${stroke}"/>`;
    case 'small_square':
      return `<rect x="${CX - 4}" y="${y - 4}" width="8" height="8" fill="${stroke}"/>`;
    default:
      return '';
  }
}
