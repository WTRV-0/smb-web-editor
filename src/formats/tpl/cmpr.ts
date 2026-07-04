/**
 * GX CMPR (S3TC/DXT1-style) texture encoder.
 * Layout: image divided into 8x8 tiles (row-major); each tile holds four 4x4
 * DXT1 blocks in 2x2 order. Block: two big-endian RGB565 colors + 16 2-bit
 * indices (MSB-first per row byte). c0 > c1 selects 4-color mode; pixels with
 * alpha < 128 force 3-color+transparent mode (c0 <= c1, index 3).
 */

export function encodeCmpr(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const tilesX = Math.ceil(width / 8);
  const tilesY = Math.ceil(height / 8);
  const out = new Uint8Array(tilesX * tilesY * 32);
  let o = 0;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      for (const [bx, by] of [
        [0, 0],
        [4, 0],
        [0, 4],
        [4, 4],
      ]) {
        encodeBlock(rgba, width, height, tx * 8 + bx, ty * 8 + by, out, o);
        o += 8;
      }
    }
  }
  return out;
}

function encodeBlock(
  rgba: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  out: Uint8Array,
  o: number,
): void {
  // Gather up to 16 pixels (clamp at edges)
  const px: number[][] = [];
  let hasTransparency = false;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const sx = Math.min(x0 + x, width - 1);
      const sy = Math.min(y0 + y, height - 1);
      const i = (sy * width + sx) * 4;
      const p = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
      if (p[3] < 128) hasTransparency = true;
      px.push(p);
    }
  }

  // Bounding-box color endpoints over opaque pixels
  let minR = 255,
    minG = 255,
    minB = 255,
    maxR = 0,
    maxG = 0,
    maxB = 0;
  let anyOpaque = false;
  for (const p of px) {
    if (p[3] < 128) continue;
    anyOpaque = true;
    minR = Math.min(minR, p[0]);
    minG = Math.min(minG, p[1]);
    minB = Math.min(minB, p[2]);
    maxR = Math.max(maxR, p[0]);
    maxG = Math.max(maxG, p[1]);
    maxB = Math.max(maxB, p[2]);
  }
  if (!anyOpaque) {
    minR = minG = minB = maxR = maxG = maxB = 0;
  }

  let c0 = to565(maxR, maxG, maxB);
  let c1 = to565(minR, minG, minB);

  if (hasTransparency) {
    // 3-color mode requires c0 <= c1
    if (c0 > c1) [c0, c1] = [c1, c0];
  } else if (c0 === c1) {
    // avoid accidental 3-color mode for solid blocks
    if (c1 > 0) c1 -= 1;
    else c0 += 1;
  } else if (c0 < c1) {
    [c0, c1] = [c1, c0];
  }

  const threeColor = hasTransparency || c0 <= c1;
  const pal = palette(c0, c1, threeColor);

  out[o] = c0 >> 8;
  out[o + 1] = c0 & 0xff;
  out[o + 2] = c1 >> 8;
  out[o + 3] = c1 & 0xff;

  for (let y = 0; y < 4; y++) {
    let byte = 0;
    for (let x = 0; x < 4; x++) {
      const p = px[y * 4 + x];
      let idx: number;
      if (p[3] < 128) {
        idx = 3;
      } else {
        idx = nearest(pal, p, threeColor ? 3 : 4);
      }
      byte |= idx << ((3 - x) * 2);
    }
    out[o + 4 + y] = byte;
  }
}

function to565(r: number, g: number, b: number): number {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

function from565(c: number): [number, number, number] {
  const r = (c >> 11) & 0x1f;
  const g = (c >> 5) & 0x3f;
  const b = c & 0x1f;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function palette(c0: number, c1: number, threeColor: boolean): [number, number, number][] {
  const p0 = from565(c0);
  const p1 = from565(c1);
  if (threeColor) {
    return [p0, p1, [(p0[0] + p1[0]) >> 1, (p0[1] + p1[1]) >> 1, (p0[2] + p1[2]) >> 1], [0, 0, 0]];
  }
  return [
    p0,
    p1,
    [Math.round((2 * p0[0] + p1[0]) / 3), Math.round((2 * p0[1] + p1[1]) / 3), Math.round((2 * p0[2] + p1[2]) / 3)],
    [Math.round((p0[0] + 2 * p1[0]) / 3), Math.round((p0[1] + 2 * p1[1]) / 3), Math.round((p0[2] + 2 * p1[2]) / 3)],
  ];
}

/** limit=3 in 3-color mode so opaque pixels never map to the transparent index */
function nearest(pal: [number, number, number][], p: number[], limit: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < limit; i++) {
    const d =
      (pal[i][0] - p[0]) * (pal[i][0] - p[0]) +
      (pal[i][1] - p[1]) * (pal[i][1] - p[1]) +
      (pal[i][2] - p[2]) * (pal[i][2] - p[2]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
