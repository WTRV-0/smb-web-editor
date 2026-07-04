import { describe, expect, it } from 'vitest';
import { lzCompress, lzDecompress } from './lzss';

function randomBytes(n: number, seed = 12345): Uint8Array {
  // Deterministic LCG so failures are reproducible
  const out = new Uint8Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (s >> 16) & 0xff;
  }
  return out;
}

describe('lz compression', () => {
  it('round-trips empty input', () => {
    expect(lzDecompress(lzCompress(new Uint8Array(0)))).toEqual(new Uint8Array(0));
  });

  it('round-trips short text', () => {
    const data = new TextEncoder().encode('banana banana banana monkey ball');
    expect(lzDecompress(lzCompress(data))).toEqual(data);
  });

  it('round-trips highly repetitive data with good ratio', () => {
    const data = new Uint8Array(50000);
    for (let i = 0; i < data.length; i++) data[i] = i % 7;
    const compressed = lzCompress(data);
    expect(compressed.length).toBeLessThan(data.length / 4);
    expect(lzDecompress(compressed)).toEqual(data);
  });

  it('round-trips incompressible random data', () => {
    const data = randomBytes(30000);
    expect(lzDecompress(lzCompress(data))).toEqual(data);
  });

  it('round-trips data with zero runs (ring buffer init match)', () => {
    const data = new Uint8Array(10000); // all zeros compress against the zero-filled ring
    const compressed = lzCompress(data);
    // max match length is 18, so ~2.2 bytes per 18 input bytes is optimal
    expect(compressed.length).toBeLessThan(1300);
    expect(lzDecompress(compressed)).toEqual(data);
  });

  it('writes little-endian sizes in the header', () => {
    const data = new TextEncoder().encode('hello');
    const compressed = lzCompress(data);
    const view = new DataView(compressed.buffer);
    expect(view.getUint32(0, true)).toBe(compressed.length);
    expect(view.getUint32(4, true)).toBe(5);
  });
});
