/**
 * GameCube disc filesystem (FST) parsing and patching.
 *
 * Disc header (boot.bin): u32 BE FST offset at 0x424, u32 BE FST size at 0x428.
 * FST: 12-byte entries. Entry 0 is the root directory; its length field is the
 * total entry count. Entry: u8 flags (0 file, 1 dir), u24 name offset into the
 * string table (which follows the entries), u32 file offset (dirs: parent
 * index), u32 length (dirs: index of first entry after the directory).
 */

export const FST_OFFSET_FIELD = 0x424;
export const FST_SIZE_FIELD = 0x428;

export interface IsoFileEntry {
  /** full path inside the disc, '/'-joined */
  path: string;
  /** index of the 12-byte FST entry */
  entryIndex: number;
  offset: number;
  length: number;
}

export function readDiscHeader(header: Uint8Array): { gameId: string; fstOffset: number; fstSize: number } {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const gameId = new TextDecoder('ascii').decode(header.subarray(0, 6));
  return {
    gameId,
    fstOffset: view.getUint32(FST_OFFSET_FIELD, false),
    fstSize: view.getUint32(FST_SIZE_FIELD, false),
  };
}

export function parseFst(fst: Uint8Array): IsoFileEntry[] {
  const view = new DataView(fst.buffer, fst.byteOffset, fst.byteLength);
  const entryCount = view.getUint32(8, false);
  const stringTableStart = entryCount * 12;
  const decoder = new TextDecoder('shift-jis');

  const nameAt = (nameOffset: number): string => {
    let end = stringTableStart + nameOffset;
    while (end < fst.length && fst[end] !== 0) end++;
    return decoder.decode(fst.subarray(stringTableStart + nameOffset, end));
  };

  const files: IsoFileEntry[] = [];
  // Iterative walk: directories declare the exclusive end index of their contents
  const dirStack: { end: number; path: string }[] = [{ end: entryCount, path: '' }];
  for (let i = 1; i < entryCount; i++) {
    while (dirStack.length > 1 && i >= dirStack[dirStack.length - 1].end) dirStack.pop();
    const base = i * 12;
    const flags = view.getUint8(base);
    const nameOffset = (view.getUint8(base + 1) << 16) | view.getUint16(base + 2, false);
    const offsetOrParent = view.getUint32(base + 4, false);
    const lengthOrEnd = view.getUint32(base + 8, false);
    const name = nameAt(nameOffset);
    const parentPath = dirStack[dirStack.length - 1].path;
    if (flags === 1) {
      dirStack.push({ end: lengthOrEnd, path: parentPath ? `${parentPath}/${name}` : name });
    } else {
      files.push({
        path: parentPath ? `${parentPath}/${name}` : name,
        entryIndex: i,
        offset: offsetOrParent,
        length: lengthOrEnd,
      });
    }
  }
  return files;
}

/** Update a file entry's offset/length in the raw FST bytes (in place). */
export function patchFstEntry(fst: Uint8Array, entryIndex: number, offset: number, length: number): void {
  const view = new DataView(fst.buffer, fst.byteOffset, fst.byteLength);
  view.setUint32(entryIndex * 12 + 4, offset, false);
  view.setUint32(entryIndex * 12 + 8, length, false);
}

/** Find a file by name (case-insensitive), optionally requiring a path suffix match. */
export function findFile(files: IsoFileEntry[], name: string): IsoFileEntry | undefined {
  const lower = name.toLowerCase();
  return (
    files.find((f) => f.path.toLowerCase() === lower) ??
    files.find((f) => f.path.toLowerCase().endsWith(`/${lower}`)) ??
    files.find((f) => {
      const base = f.path.toLowerCase().split('/').pop();
      return base === lower;
    })
  );
}
