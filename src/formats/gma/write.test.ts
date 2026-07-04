import { describe, expect, it } from 'vitest';
import { writeGma, type GmaModelInput } from './write';
import { writeTpl } from '../tpl/write';
import { encodeCmpr } from '../tpl/cmpr';

const u32 = (b: Uint8Array, o: number) => new DataView(b.buffer).getUint32(o, false);
const u16 = (b: Uint8Array, o: number) => new DataView(b.buffer).getUint16(o, false);

function triModel(name = 'IG0'): GmaModelInput {
  return {
    name,
    materials: [{ textureIndex: 0 }],
    meshes: [
      {
        materialIndex: 0,
        vertices: [
          { px: 0, py: 0, pz: 0, nx: 0, ny: 1, nz: 0, u: 0, v: 0 },
          { px: 1, py: 0, pz: 0, nx: 0, ny: 1, nz: 0, u: 1, v: 0 },
          { px: 0, py: 0, pz: 1, nx: 0, ny: 1, nz: 0, u: 0, v: 1 },
        ],
      },
    ],
  };
}

describe('gma writer', () => {
  it('writes a valid container and GCMF header', () => {
    const gma = writeGma([triModel()]);
    expect(u32(gma, 0)).toBe(1); // model count
    const base = u32(gma, 4);
    expect(base % 0x20).toBe(0);
    expect(u32(gma, 8)).toBe(0); // first model offset
    expect(u32(gma, 12)).toBe(0); // first name offset
    // name table
    const name = new TextDecoder().decode(gma.subarray(16, 19));
    expect(name).toBe('IG0');
    // GCMF magic at model base
    expect(u32(gma, base)).toBe(0x47434d46);
    expect(u32(gma, base + 4)).toBe(0); // section flags
    expect(u16(gma, base + 24)).toBe(1); // material count
    expect(u16(gma, base + 26)).toBe(1); // layer1 mesh count
    // material index field inside material entry
    const matBase = base + 0x40;
    expect(u16(gma, matBase + 14)).toBe(0);
    // mesh header follows aligned material section
    const meshBase = base + u32(gma, base + 32);
    expect(u32(gma, meshBase + 28)).toBe(0x2600); // vertex flags pos|normal|uv
    // chunk1 size = 3 header bytes + 3 verts * 32 bytes
    expect(u32(gma, meshBase + 40)).toBe(3 + 3 * 32);
    // strip data begins after 0x60 header: 0x98 marker + count 3
    expect(gma[meshBase + 0x60]).toBe(0x98);
    expect(u16(gma, meshBase + 0x61)).toBe(3);
    // total size sanity: model content padded to 0x20
    const content = u32(gma, base + 32) + 0x60 + 3 + 3 * 32;
    expect(gma.length).toBe(base + (content + 0x1f - ((content + 0x1f) % 0x20)));
  });

  it('deduplicates nothing but keeps multiple models addressable', () => {
    const gma = writeGma([triModel('IG0'), triModel('IG1')]);
    expect(u32(gma, 0)).toBe(2);
    const modelSize = u32(gma, 16) - u32(gma, 8);
    expect(modelSize).toBeGreaterThan(0);
    expect(u32(gma, 20)).toBe(4); // second name offset after 'IG0\0'
  });
});

describe('tpl writer', () => {
  it('writes header entries and CMPR data', () => {
    const rgba = new Uint8Array(8 * 8 * 4).fill(255);
    const tpl = writeTpl([{ rgba, width: 8, height: 8 }]);
    expect(u32(tpl, 0)).toBe(1);
    expect(u32(tpl, 4)).toBe(14); // CMPR
    const dataOffset = u32(tpl, 8);
    expect(dataOffset % 0x20).toBe(0);
    expect(u16(tpl, 12)).toBe(8);
    expect(u16(tpl, 14)).toBe(8);
    expect(u16(tpl, 16)).toBe(1); // levels
    expect(u16(tpl, 18)).toBe(0x1234);
    expect(tpl.length).toBe(dataOffset + 32); // one 8x8 CMPR tile = 32 bytes
  });

  it('encodes solid-color CMPR blocks losslessly for 565-representable colors', () => {
    const rgba = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < 64; i++) {
      rgba[i * 4] = 0xff; // 255 -> exact in 565
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 255;
    }
    const data = encodeCmpr(rgba, 8, 8);
    expect(data.length).toBe(32);
    // first block: c0 must decode to pure red, all indices 0
    const c0 = (data[0] << 8) | data[1];
    expect(c0 >> 11).toBe(0x1f);
    expect((c0 >> 5) & 0x3f).toBe(0);
    expect(data[4]).toBe(0);
    expect(data[5]).toBe(0);
  });
});
