import { describe, expect, it } from 'vitest';
import { writeTpl, GX_CMPR } from './write';
import { extractTplTexture, readTpl } from './read';
import { decodeTexture } from './decode';
import { encodeCmpr } from './cmpr';

const u32 = (b: Uint8Array, o: number) => new DataView(b.buffer).getUint32(o, false);

function solidRgba(r: number, g: number, b: number, w = 8, h = 8): Uint8Array {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

describe('tpl read/write round-trip', () => {
  it('reads back what it writes and locates data blocks', () => {
    const tpl = writeTpl([
      { rgba: solidRgba(255, 0, 0), width: 8, height: 8 },
      { rgba: solidRgba(0, 128, 0, 16, 16), width: 16, height: 16 },
    ]);
    const read = readTpl(tpl);
    expect(read.entries).toHaveLength(2);
    expect(read.entries[0].format).toBe(GX_CMPR);
    expect(read.entries[0].width).toBe(8);
    expect(read.entries[1].width).toBe(16);
    // first block is a single 8x8 CMPR tile = 32 bytes
    expect(read.entries[0].dataLength).toBe(32);
    // 16x16 CMPR = 4 tiles = 128 bytes
    expect(read.entries[1].dataLength).toBe(128);
  });

  it('copies a raw texture block verbatim into a new TPL (donor-copy path)', () => {
    const donor = writeTpl([
      { rgba: solidRgba(10, 20, 30), width: 8, height: 8 },
      { rgba: solidRgba(200, 100, 50, 16, 16), width: 16, height: 16 },
    ]);
    const read = readTpl(donor);
    const extracted = extractTplTexture(read, 1);
    expect(extracted.format).toBe(GX_CMPR);
    expect(extracted.width).toBe(16);

    // re-embed the raw block alongside a freshly generated one
    const rebuilt = writeTpl([
      { rgba: solidRgba(0, 0, 0), width: 8, height: 8 },
      { raw: extracted.raw, format: extracted.format, width: extracted.width, height: extracted.height, levelCount: extracted.levelCount },
    ]);
    const reread = readTpl(rebuilt);
    const reExtracted = extractTplTexture(reread, 1);
    // the copied block survives unchanged
    expect(Array.from(reExtracted.raw)).toEqual(Array.from(extracted.raw));
    expect(u32(rebuilt, 4 + 16)).toBe(GX_CMPR); // second entry format field
  });

  it('decodes a CMPR block back to approximately the original color', () => {
    const cmpr = encodeCmpr(solidRgba(220, 40, 40), 8, 8);
    const rgba = decodeTexture(GX_CMPR, cmpr, 8, 8);
    // center pixel should be close to the source red
    const i = (4 * 8 + 4) * 4;
    expect(rgba[i]).toBeGreaterThan(180);
    expect(rgba[i + 1]).toBeLessThan(90);
    expect(rgba[i + 2]).toBeLessThan(90);
    expect(rgba[i + 3]).toBe(255);
  });

  it('falls back to a neutral checker for unsupported formats', () => {
    const rgba = decodeTexture(6 /* RGBA32 unsupported here */, new Uint8Array(64), 8, 8);
    expect(rgba).toHaveLength(8 * 8 * 4);
    expect(rgba[3]).toBe(255);
  });
});
