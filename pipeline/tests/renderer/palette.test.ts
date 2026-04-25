import { describe, expect, it } from 'vitest';
import { hex } from '../../src/renderer/palette.ts';
import { RENDERER_VERSION } from '../../src/renderer/version.ts';

describe('palette', () => {
  it('maps named colors to hex (per spec 4.4 anchors)', () => {
    expect(hex('red')).toBe('#D32F2F');
    expect(hex('blue')).toBe('#1E5BCC');
    expect(hex('yellow')).toBe('#F5C518');
    expect(hex('black')).toBe('#111111');
    expect(hex('white')).toBe('#FAFAFA');
    expect(hex('accent_cyan')).toBe('#2A9DC9');
    expect(hex('accent_ochre')).toBe('#B8862E');
    expect(hex('accent_deep_red')).toBe('#8A1F1F');
  });
});

describe('renderer version', () => {
  it('exposes a semver string', () => {
    expect(RENDERER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
