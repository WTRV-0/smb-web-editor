/**
 * GX texture decoders for the ISO texture browser preview. Only level 0 is
 * decoded, and only the formats common to SMB2 stage/background textures.
 * Unsupported formats return a neutral checker so the entry is still browsable
 * (the raw block is copied verbatim at patch time regardless of format).
 */

export const GX_FORMATS: Record<number, string> = {
  0: 'I4',
  1: 'I8',
  2: 'IA4',
  3: 'IA8',
  4: 'RGB565',
  5: 'RGB5A3',
  6: 'RGBA32',
  8: 'CI4',
  9: 'CI8',
  10: 'CI14',
  14: 'CMPR',
};

export function decodeTexture(format: number, block: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  try {
    switch (format) {
      case 14:
        decodeCmpr(block, width, height, out);
        break;
      case 5:
        decode16(block, width, height, out, rgb5a3);
        break;
      case 4:
        decode16(block, width, height, out, rgb565);
        break;
      case 3:
        decode16(block, width, height, out, ia8);
        break;
      case 1:
        decodeI8(block, width, height, out);
        break;
      default:
        return checker(width, height);
    }
  } catch {
    return checker(width, height);
  }
  return out;
}

function put(out: Uint8Array, w: number, h: number, x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  out[i] = r;
  out[i + 1] = g;
  out[i + 2] = b;
  out[i + 3] = a;
}

function from565(c: number): [number, number, number] {
  const r = (c >> 11) & 0x1f;
  const g = (c >> 5) & 0x3f;
  const b = c & 0x1f;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

/** CMPR: 8×8 tiles of four 4×4 DXT1 blocks (2×2), MSB-first indices. */
function decodeCmpr(block: Uint8Array, w: number, h: number, out: Uint8Array) {
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
  let off = 0;
  for (let ty = 0; ty < h; ty += 8) {
    for (let tx = 0; tx < w; tx += 8) {
      for (let by = 0; by < 8; by += 4) {
        for (let bx = 0; bx < 8; bx += 4) {
          if (off + 8 > block.length) return;
          const c0 = view.getUint16(off, false);
          const c1 = view.getUint16(off + 2, false);
          const p0 = from565(c0);
          const p1 = from565(c1);
          const pal: [number, number, number, number][] = [
            [...p0, 255],
            [...p1, 255],
            c0 > c1
              ? [Math.round((2 * p0[0] + p1[0]) / 3), Math.round((2 * p0[1] + p1[1]) / 3), Math.round((2 * p0[2] + p1[2]) / 3), 255]
              : [(p0[0] + p1[0]) >> 1, (p0[1] + p1[1]) >> 1, (p0[2] + p1[2]) >> 1, 255],
            c0 > c1
              ? [Math.round((p0[0] + 2 * p1[0]) / 3), Math.round((p0[1] + 2 * p1[1]) / 3), Math.round((p0[2] + 2 * p1[2]) / 3), 255]
              : [0, 0, 0, 0],
          ];
          for (let py = 0; py < 4; py++) {
            const rowByte = block[off + 4 + py];
            for (let px = 0; px < 4; px++) {
              const idx = (rowByte >> (2 * (3 - px))) & 3;
              const c = pal[idx];
              put(out, w, h, tx + bx + px, ty + by + py, c[0], c[1], c[2], c[3]);
            }
          }
          off += 8;
        }
      }
    }
  }
}

/** Generic 16-bpp decode over 4×4 tiles using a pixel converter. */
function decode16(block: Uint8Array, w: number, h: number, out: Uint8Array, conv: (v: number) => [number, number, number, number]) {
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
  let off = 0;
  for (let ty = 0; ty < h; ty += 4) {
    for (let tx = 0; tx < w; tx += 4) {
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          if (off + 2 > block.length) return;
          const [r, g, b, a] = conv(view.getUint16(off, false));
          off += 2;
          put(out, w, h, tx + px, ty + py, r, g, b, a);
        }
      }
    }
  }
}

function rgb565(v: number): [number, number, number, number] {
  const [r, g, b] = from565(v);
  return [r, g, b, 255];
}

function rgb5a3(v: number): [number, number, number, number] {
  if (v & 0x8000) {
    const r = (v >> 10) & 0x1f;
    const g = (v >> 5) & 0x1f;
    const b = v & 0x1f;
    return [(r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2), 255];
  }
  const a = (v >> 12) & 0x7;
  const r = (v >> 8) & 0xf;
  const g = (v >> 4) & 0xf;
  const b = v & 0xf;
  return [(r << 4) | r, (g << 4) | g, (b << 4) | b, (a << 5) | (a << 2) | (a >> 1)];
}

function ia8(v: number): [number, number, number, number] {
  const a = (v >> 8) & 0xff;
  const i = v & 0xff;
  return [i, i, i, a];
}

/** I8: 8×4 tiles, 8bpp intensity. */
function decodeI8(block: Uint8Array, w: number, h: number, out: Uint8Array) {
  let off = 0;
  for (let ty = 0; ty < h; ty += 4) {
    for (let tx = 0; tx < w; tx += 8) {
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 8; px++) {
          if (off >= block.length) return;
          const i = block[off++];
          put(out, w, h, tx + px, ty + py, i, i, i, 255);
        }
      }
    }
  }
}

function checker(w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = (((x >> 3) + (y >> 3)) & 1) === 0;
      const v = on ? 120 : 80;
      const i = (y * w + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** RGBA → PNG data URL for the browser thumbnails. */
export function rgbaToDataUrl(rgba: Uint8Array, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(width, height);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
