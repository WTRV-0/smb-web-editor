import { BinaryWriter } from '../util/BinaryWriter';
import { encodeCmpr } from './cmpr';

/** GX texture format ids */
export const GX_CMPR = 14;

/** A texture to write: either RGBA to be CMPR-encoded, or a pre-encoded GX block. */
export type TplTextureInput =
  | { rgba: Uint8Array; width: number; height: number }
  | { raw: Uint8Array; format: number; width: number; height: number; levelCount: number };

function isRaw(t: TplTextureInput): t is Extract<TplTextureInput, { raw: Uint8Array }> {
  return 'raw' in t;
}

/**
 * Write a SMB2 .tpl texture container (GxUtils Tpl.Save, GC big-endian):
 * u32 count; per texture: u32 format, u32 data offset, u16 w, u16 h,
 * u16 level count, u16 0x1234; pad to 0x20 with 0x00,0x01,0x02...; raw data.
 *
 * RGBA inputs are CMPR-encoded; `raw` inputs (copied out of a game TPL) are
 * written back verbatim with their original format so no re-encoding loss.
 */
export function writeTpl(textures: TplTextureInput[]): Uint8Array {
  const blocks = textures.map((t) => (isRaw(t) ? t.raw : encodeCmpr(t.rgba, t.width, t.height)));

  const headerSize = align32(4 + 16 * textures.length);
  const w = new BinaryWriter(headerSize + blocks.reduce((a, e) => a + e.length, 0));

  w.u32(textures.length);
  let dataOffset = headerSize;
  for (let i = 0; i < textures.length; i++) {
    const t = textures[i];
    w.u32(isRaw(t) ? t.format : GX_CMPR);
    w.u32(dataOffset);
    w.u16(t.width);
    w.u16(t.height);
    w.u16(isRaw(t) ? t.levelCount : 1);
    w.u16(0x1234);
    dataOffset += blocks[i].length;
  }
  // curious ascending-byte padding pattern, matching GxUtils/retail files
  let padByte = 0;
  while (w.offset < headerSize) w.u8(padByte++ & 0xff);

  for (const b of blocks) w.raw(b);
  return w.toUint8Array();
}

function align32(n: number): number {
  return (n + 0x1f) & ~0x1f;
}
