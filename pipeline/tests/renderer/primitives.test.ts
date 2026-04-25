import { describe, expect, it } from 'vitest';
import { renderBody, renderTail, renderFin, renderEye } from '../../src/renderer/primitives.ts';

describe('renderBody', () => {
  it('renders triangle pointing right', () => {
    const svg = renderBody({ primitive: 'triangle', orientation: 'right', color: 'blue' });
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#1E5BCC'); // blue
    expect(svg).toMatch(/points="[\d., -]*"/);
  });

  it('renders ellipse', () => {
    const svg = renderBody({ primitive: 'ellipse', orientation: 'right', color: 'red' });
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('#D32F2F');
  });

  it('renders rectangle', () => {
    const svg = renderBody({ primitive: 'rectangle', orientation: 'right', color: 'yellow' });
    expect(svg).toContain('<rect');
    expect(svg).toContain('#F5C518');
  });

  it('is deterministic — same input produces identical output', () => {
    const a = renderBody({ primitive: 'ellipse', orientation: 'left', color: 'black' });
    const b = renderBody({ primitive: 'ellipse', orientation: 'left', color: 'black' });
    expect(a).toBe(b);
  });
});

describe('renderTail', () => {
  it('renders a triangle on the side opposite to body orientation', () => {
    const svg = renderTail({ primitive: 'triangle', color: 'red', side: 'left' });
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#D32F2F');
  });
});

describe('renderEye', () => {
  it('renders double_circle (white outer + black inner)', () => {
    const svg = renderEye({ style: 'double_circle', position: 'front_top' });
    expect(svg).toMatch(/<circle.*#FAFAFA/);
    expect(svg).toMatch(/<circle.*#111111/);
  });
  it('renders dot as a single black circle', () => {
    const svg = renderEye({ style: 'dot', position: 'front_center' });
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBe(1);
  });
});

describe('renderFin', () => {
  it('renders top fin as a triangle above the body midline', () => {
    const svg = renderFin({ primitive: 'triangle', color: 'blue' }, 'top');
    expect(svg).toContain('<polygon');
  });
});
