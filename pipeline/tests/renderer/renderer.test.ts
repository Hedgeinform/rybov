import { describe, expect, it } from 'vitest';
import { render } from '../../src/renderer/renderer.ts';
import type { DSL } from '../../src/dsl/schema.ts';

const triangleArrow: DSL = {
  body: { primitive: 'composite_two_triangles', orientation: 'right', color: 'blue' },
  eye: { style: 'double_circle', position: 'front_top' },
  tail: { primitive: 'triangle', color: 'red', side: 'left' },
  fin_top: null, fin_bottom: null,
  background_block: { color: 'yellow', size: 'large', offset: [-15, -15] },
  accents: [{ type: 'horizontal_line', color: 'black', position: 'midline' }],
};

describe('render', () => {
  it('produces a complete SVG document', () => {
    const svg = render(triangleArrow);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox="0 0 200 140"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('orders elements: bg fill → bg_block → accents → body → tail → fins → eye', () => {
    const svg = render(triangleArrow);
    // Yellow block must appear BEFORE blue body in the SVG string
    const yellowIdx = svg.indexOf('#F5C518');
    const blueIdx = svg.indexOf('#1E5BCC');
    expect(yellowIdx).toBeGreaterThan(0);
    expect(blueIdx).toBeGreaterThan(yellowIdx);
  });

  it('embeds intrinsic canvas (#FAFAFA) when no bg_block', () => {
    const noBg = { ...triangleArrow, background_block: null };
    const svg = render(noBg);
    expect(svg).toContain('#FAFAFA');
  });

  it('is deterministic — same DSL → identical SVG', () => {
    expect(render(triangleArrow)).toBe(render(triangleArrow));
  });
});

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(__dirname, '__golden__', 'triangle-arrow.svg');

describe('golden snapshot', () => {
  it('triangle-arrow matches stored golden', () => {
    const svg = render(triangleArrow);
    if (!existsSync(goldenPath)) {
      writeFileSync(goldenPath, svg);
      throw new Error(`Wrote initial golden to ${goldenPath}; commit and re-run.`);
    }
    const golden = readFileSync(goldenPath, 'utf-8');
    expect(svg).toBe(golden);
  });
});
