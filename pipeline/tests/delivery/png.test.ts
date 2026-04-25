import { describe, expect, it } from 'vitest';
import { svgToPng, TARGET_PNG_WIDTH } from '../../src/delivery/png.ts';

const FLUID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140"><rect width="200" height="140" fill="#FAFAFA"/><circle cx="100" cy="70" r="40" fill="#A02C5B"/></svg>';

describe('svgToPng', () => {
  it('produces a PNG buffer (PNG magic bytes 89 50 4E 47)', async () => {
    const buf = await svgToPng(FLUID_SVG);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it('renders at the target width regardless of SVG having no width/height attrs', async () => {
    const buf = await svgToPng(FLUID_SVG);
    // PNG IHDR chunk: bytes 16..19 = width (big-endian uint32)
    const w = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
    expect(w).toBe(TARGET_PNG_WIDTH);
  });

  it('preserves the 200:140 aspect ratio (within 1px rounding)', async () => {
    const buf = await svgToPng(FLUID_SVG);
    const w = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
    const h = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
    const expectedH = Math.round((w * 140) / 200);
    expect(Math.abs(h - expectedH)).toBeLessThanOrEqual(1);
  });
});
