import { describe, expect, it } from 'vitest';
import { findFile, parseFst, patchFstEntry, readDiscHeader } from './fst';

/** Build a small synthetic FST: root -> file A, dir "stage" -> [STAGE201.lz] */
function syntheticFst(): Uint8Array {
  const names = ['a.bin', 'stage', 'STAGE201.lz'];
  const stringTable: number[] = [];
  const nameOffsets: number[] = [];
  for (const n of names) {
    nameOffsets.push(stringTable.length);
    for (const ch of new TextEncoder().encode(n)) stringTable.push(ch);
    stringTable.push(0);
  }
  const entryCount = 4; // root + 3
  const fst = new Uint8Array(entryCount * 12 + stringTable.length);
  const view = new DataView(fst.buffer);
  // root
  view.setUint8(0, 1);
  view.setUint32(8, entryCount, false);
  // entry 1: file a.bin at 0x10000, len 100
  view.setUint8(12, 0);
  view.setUint32(12, (0 << 24) | nameOffsets[0], false);
  view.setUint8(12, 0);
  view.setUint32(16, 0x10000, false);
  view.setUint32(20, 100, false);
  // entry 2: dir stage, parent 0, end 4
  view.setUint32(24, (1 << 24) | nameOffsets[1], false);
  view.setUint32(28, 0, false);
  view.setUint32(32, 4, false);
  // entry 3: file STAGE201.lz at 0x20000, len 5000
  view.setUint32(36, (0 << 24) | nameOffsets[2], false);
  view.setUint32(40, 0x20000, false);
  view.setUint32(44, 5000, false);
  fst.set(stringTable, entryCount * 12);
  return fst;
}

describe('gc iso fst', () => {
  it('parses files with directory paths', () => {
    const files = parseFst(syntheticFst());
    expect(files.map((f) => f.path)).toEqual(['a.bin', 'stage/STAGE201.lz']);
    expect(files[1].offset).toBe(0x20000);
    expect(files[1].length).toBe(5000);
  });

  it('finds files case-insensitively by name', () => {
    const files = parseFst(syntheticFst());
    expect(findFile(files, 'stage201.LZ')?.entryIndex).toBe(3);
    expect(findFile(files, 'missing.lz')).toBeUndefined();
  });

  it('patches entries in place', () => {
    const fst = syntheticFst();
    patchFstEntry(fst, 3, 0x900000, 7777);
    const files = parseFst(fst);
    expect(files[1].offset).toBe(0x900000);
    expect(files[1].length).toBe(7777);
  });

  it('reads disc header fields', () => {
    const header = new Uint8Array(0x440);
    header.set(new TextEncoder().encode('GM2E8P'), 0);
    new DataView(header.buffer).setUint32(0x424, 0x456e00, false);
    new DataView(header.buffer).setUint32(0x428, 0x2000, false);
    const info = readDiscHeader(header);
    expect(info.gameId).toBe('GM2E8P');
    expect(info.fstOffset).toBe(0x456e00);
    expect(info.fstSize).toBe(0x2000);
  });
});
