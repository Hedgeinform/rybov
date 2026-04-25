import { describe, expect, it } from 'vitest';
import { renderBody } from '../../src/renderer/primitives.ts';

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
