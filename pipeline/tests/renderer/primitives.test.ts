import { describe, expect, it } from 'vitest';
import {
  renderBody, renderHead, renderTail, renderFin, renderEye,
  renderBackgroundBlock, renderAccent,
} from '../../src/renderer/primitives.ts';

describe('renderBody', () => {
  it('renders triangle pointing right', () => {
    const svg = renderBody({ primitive: 'triangle', orientation: 'right', color: 'blue' });
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#3D2E8C'); // blue
    expect(svg).toMatch(/points="[\d., -]*"/);
  });

  it('renders ellipse', () => {
    const svg = renderBody({ primitive: 'ellipse', orientation: 'right', color: 'red' });
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('#A02C5B');
  });

  it('renders rectangle', () => {
    const svg = renderBody({ primitive: 'rectangle', orientation: 'right', color: 'yellow' });
    expect(svg).toContain('<rect');
    expect(svg).toContain('#C8A435');
  });

  it('is deterministic — same input produces identical output', () => {
    const a = renderBody({ primitive: 'ellipse', orientation: 'left', color: 'black' });
    const b = renderBody({ primitive: 'ellipse', orientation: 'left', color: 'black' });
    expect(a).toBe(b);
  });
});

describe('renderHead', () => {
  it('renders circle head', () => {
    const svg = renderHead({ primitive: 'circle', color: 'red', orientation: 'right' });
    expect(svg).toContain('<circle');
    expect(svg).toContain('#A02C5B');
  });
  it('renders oval head as ellipse', () => {
    const svg = renderHead({ primitive: 'oval', color: 'blue', orientation: 'right' });
    expect(svg).toContain('<ellipse');
  });
  it('renders triangle head pointing in body direction', () => {
    const svg = renderHead({ primitive: 'triangle', color: 'yellow', orientation: 'right' });
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#C8A435');
  });
});

describe('renderTail', () => {
  it('renders a triangle on the left', () => {
    const svg = renderTail({ primitive: 'triangle', color: 'red', side: 'left' });
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#A02C5B');
  });
  it('renders a rectangle tail', () => {
    const svg = renderTail({ primitive: 'rectangle', color: 'red', side: 'left' });
    expect(svg).toContain('<rect');
  });
  it('renders an arrow tail as a 4-vertex concave polygon', () => {
    const svg = renderTail({ primitive: 'arrow', color: 'red', side: 'left' });
    const points = svg.match(/points="([^"]+)"/)?.[1] ?? '';
    const vertexCount = points.trim().split(/\s+/).length;
    expect(vertexCount).toBe(4);
  });
  it('renders a fork tail as a 7-vertex polygon', () => {
    const svg = renderTail({ primitive: 'fork', color: 'red', side: 'left' });
    const points = svg.match(/points="([^"]+)"/)?.[1] ?? '';
    const vertexCount = points.trim().split(/\s+/).length;
    expect(vertexCount).toBe(7);
  });
});

describe('renderEye', () => {
  it('renders double_circle (white outer + black inner) on body when no head', () => {
    const svg = renderEye({ style: 'double_circle', position: 'front_top', hasHead: false, bodyOrientation: 'right' });
    expect(svg).toMatch(/<circle.*#FAFAFA/);
    expect(svg).toMatch(/<circle.*#111111/);
  });
  it('renders dot as a single black circle', () => {
    const svg = renderEye({ style: 'dot', position: 'front_center', hasHead: false, bodyOrientation: 'right' });
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBe(1);
  });
  it('places eye on the head when head is present', () => {
    const withHead = renderEye({ style: 'dot', position: 'head_center', hasHead: true, bodyOrientation: 'right' });
    const onBody = renderEye({ style: 'dot', position: 'front_center', hasHead: false, bodyOrientation: 'right' });
    expect(withHead).not.toBe(onBody);
  });
});

describe('renderFin', () => {
  it('renders top fin as a triangle above the body midline', () => {
    const svg = renderFin({ primitive: 'triangle', color: 'blue', tilt: 'perpendicular' }, 'top', 'right');
    expect(svg).toContain('<polygon');
  });
  it('shifts apex when tilted forward', () => {
    const perp = renderFin({ primitive: 'triangle', color: 'blue', tilt: 'perpendicular' }, 'top', 'right');
    const fwd = renderFin({ primitive: 'triangle', color: 'blue', tilt: 'tilted_forward' }, 'top', 'right');
    expect(perp).not.toBe(fwd);
  });
});

describe('renderBackgroundBlock', () => {
  it('renders a colored rectangle at offset', () => {
    const svg = renderBackgroundBlock({ color: 'yellow', size: 'large', offset: [-15, -15] });
    expect(svg).toContain('<rect');
    expect(svg).toContain('#C8A435');
  });
});

describe('renderAccent', () => {
  it('renders horizontal_line as a line element', () => {
    const svg = renderAccent({ type: 'horizontal_line', color: 'black', position: 'midline' });
    expect(svg).toContain('<line');
    expect(svg).toContain('#111111');
  });
  it('renders dot as a small circle', () => {
    const svg = renderAccent({ type: 'dot', color: 'red', position: 'midline' });
    expect(svg).toContain('<circle');
  });
});
