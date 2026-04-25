import { Resvg } from '@resvg/resvg-js';

export const TARGET_PNG_WIDTH = 800;

export async function svgToPng(svg: string, width = TARGET_PNG_WIDTH): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  });
  return Buffer.from(resvg.render().asPng());
}
