/**
 * SMB2 .tpl reader. Parses the header and locates each texture's raw GX-encoded
 * data block so a texture can be copied verbatim from a donor stage's TPL (in
 * the user's own ISO) into a new stage's TPL — no game pixels are stored by the
 * tool, only extracted at patch time from the user's disc.
 */

export interface TplTextureEntry {
  format: number;
  width: number;
  height: number;
  levelCount: number;
  dataOffset: number;
  dataLength: number;
}

export interface TplReadResult {
  entries: TplTextureEntry[];
  /** the full TPL bytes (block slices reference this) */
  data: Uint8Array;
}

export function readTpl(data: Uint8Array): TplReadResult {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint32(0, false);
  if (count === 0 || count > 4096 || 4 + count * 16 > data.length) {
    throw new Error('Not a valid TPL (bad texture count).');
  }
  const partial: Omit<TplTextureEntry, 'dataLength'>[] = [];
  for (let i = 0; i < count; i++) {
    const o = 4 + i * 16;
    partial.push({
      format: view.getUint32(o, false),
      dataOffset: view.getUint32(o + 4, false),
      width: view.getUint16(o + 8, false),
      height: view.getUint16(o + 10, false),
      levelCount: view.getUint16(o + 12, false),
    });
  }
  // Each block runs from its offset to the next texture's offset (last → EOF).
  const offsetsSorted = [...partial].filter((e) => e.dataOffset > 0).sort((a, b) => a.dataOffset - b.dataOffset);
  const nextOffset = new Map<number, number>();
  for (let i = 0; i < offsetsSorted.length; i++) {
    nextOffset.set(offsetsSorted[i].dataOffset, offsetsSorted[i + 1]?.dataOffset ?? data.length);
  }
  const entries: TplTextureEntry[] = partial.map((e) => ({
    ...e,
    dataLength: e.dataOffset > 0 ? (nextOffset.get(e.dataOffset) ?? data.length) - e.dataOffset : 0,
  }));
  return { entries, data };
}

/** Extract one texture's raw encoded block plus its format/dims. */
export function extractTplTexture(
  read: TplReadResult,
  index: number,
): { raw: Uint8Array; format: number; width: number; height: number; levelCount: number } {
  const e = read.entries[index];
  if (!e) throw new Error(`Texture ${index} out of range`);
  return {
    raw: read.data.slice(e.dataOffset, e.dataOffset + e.dataLength),
    format: e.format,
    width: e.width,
    height: e.height,
    levelCount: Math.max(e.levelCount, 1),
  };
}
