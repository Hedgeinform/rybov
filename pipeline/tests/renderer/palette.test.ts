import { describe, expect, it } from 'vitest';
import { hex } from '../../src/renderer/palette.ts';
import { RENDERER_VERSION } from '../../src/renderer/version.ts';

describe('palette', () => {
  it('maps named colors to hex (per spec 4.4 anchors)', () => {
    expect(hex('red')).toBe('#A02C5B');
    expect(hex('blue')).toBe('#3D2E8C');
    expect(hex('yellow')).toBe('#C8A435');
    expect(hex('black')).toBe('#111111');
    expect(hex('white')).toBe('#FAFAFA');
    expect(hex('accent_cyan')).toBe('#2E8B7F');
    expect(hex('accent_ochre')).toBe('#6B7A2F');
    expect(hex('accent_deep_red')).toBe('#5D2A6E');
  });
});

describe('renderer version', () => {
  it('exposes a semver string', () => {
    expect(RENDERER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
