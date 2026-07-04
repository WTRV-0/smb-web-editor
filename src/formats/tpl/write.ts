import { BinaryWriter } from '../util/BinaryWriter';
import { encodeCmpr } from './cmpr';

/** GX texture format ids (we only emit CMPR) */
export const GX_CMPR = 14;

export interface TplTextureInput {
  /** RGBA8 pixels, row-major */
  rgba: Uint8Array;
  width: number;
  height: number;
}

/**
 * Write a SMB2 .tpl texture container (GxUtils Tpl.Save, GC big-endian):
 * u32 count; per texture: u32 format, u32 data offset, u16 w, u16 h,
 * u16 level count, u16 0x1234; pad to 0x20 with 0x00,0x01,0x02...; raw data.
 */
export function writeTpl(textures: TplTextureInput[]): Uint8Array {
  const encoded = textures.map((t) => encodeCmpr(t.rgba, t.width, t.height));

  const headerSize = align32(4 + 16 * textures.length);
  const w = new BinaryWriter(headerSize + encoded.reduce((a, e) => a + e.length, 0));

  w.u32(textures.length);
  let dataOffset = headerSize;
  for (let i = 0; i < textures.length; i++) {
    w.u32(GX_CMPR);
    w.u32(dataOffset);
    w.u16(textures[i].width);
    w.u16(textures[i].height);
    w.u16(1); // level count (no mipmaps)
    w.u16(0x1234);
    dataOffset += encoded[i].length;
  }
  // curious ascending-byte padding pattern, matching GxUtils/retail files
  let padByte = 0;
  while (w.offset < headerSize) w.u8(padByte++ & 0xff);

  for (const e of encoded) w.raw(e);
  return w.toUint8Array();
}

function align32(n: number): number {
  return (n + 0x1f) & ~0x1f;
}
