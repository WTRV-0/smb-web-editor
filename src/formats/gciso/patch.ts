import { findFile, parseFst, patchFstEntry, readDiscHeader } from './fst';

export interface ReplacementFile {
  /** file name inside the disc, e.g. "STAGE201.lz" */
  name: string;
  data: Uint8Array;
}

export interface PatchProgress {
  /** 0..1 */
  fraction: number;
  message: string;
}

const APPEND_ALIGN = 0x8000;
const COPY_CHUNK = 8 * 1024 * 1024;

/**
 * Patch a GameCube ISO in the browser: copies `input` to `output`, replacing
 * the named files. Replacements that fit are written in place; larger ones are
 * appended to the end of the image and the FST is updated. Requires the
 * File System Access API (Chromium browsers).
 */
export async function patchIso(
  input: File,
  output: FileSystemWritableFileStream,
  replacements: ReplacementFile[],
  onProgress: (p: PatchProgress) => void,
): Promise<void> {
  // --- read header + FST ---
  const header = new Uint8Array(await input.slice(0, 0x440).arrayBuffer());
  const { gameId, fstOffset, fstSize } = readDiscHeader(header);
  if (fstOffset === 0 || fstOffset + fstSize > input.size) {
    throw new Error('This does not look like a GameCube ISO (bad FST pointer).');
  }
  if (!gameId.startsWith('GM2')) {
    // GM2E8P / GM2P8P / GM2J8P = Super Monkey Ball 2
    const proceed = confirm(`Game ID is "${gameId}", not SMB2 (GM2x8P). Patch anyway?`);
    if (!proceed) throw new Error('Cancelled.');
  }
  const fst = new Uint8Array(await input.slice(fstOffset, fstOffset + fstSize).arrayBuffer());
  const files = parseFst(fst);

  // --- plan placements ---
  let appendCursor = alignUp(input.size, APPEND_ALIGN);
  const writes: { position: number; data: Uint8Array }[] = [];
  for (const rep of replacements) {
    const entry = findFile(files, rep.name);
    if (!entry) throw new Error(`"${rep.name}" not found in the ISO — is this really SMB2?`);
    if (rep.data.length <= entry.length) {
      writes.push({ position: entry.offset, data: rep.data });
      patchFstEntry(fst, entry.entryIndex, entry.offset, rep.data.length);
    } else {
      writes.push({ position: appendCursor, data: rep.data });
      patchFstEntry(fst, entry.entryIndex, appendCursor, rep.data.length);
      appendCursor = alignUp(appendCursor + rep.data.length, APPEND_ALIGN);
    }
  }
  writes.push({ position: fstOffset, data: fst });

  // --- copy the ISO ---
  let copied = 0;
  while (copied < input.size) {
    const end = Math.min(copied + COPY_CHUNK, input.size);
    const chunk = await input.slice(copied, end).arrayBuffer();
    await output.write({ type: 'write', position: copied, data: chunk });
    copied = end;
    onProgress({ fraction: (copied / input.size) * 0.9, message: `Copying ISO… ${Math.round((copied / input.size) * 100)}%` });
  }

  // --- grow to appended size if needed, then apply patch writes ---
  if (appendCursor > input.size) {
    await output.write({ type: 'write', position: appendCursor - 1, data: new Uint8Array(1) });
  }
  for (let i = 0; i < writes.length; i++) {
    const wr = writes[i];
    await output.write({ type: 'write', position: wr.position, data: wr.data.slice().buffer as ArrayBuffer });
    onProgress({ fraction: 0.9 + (0.1 * (i + 1)) / writes.length, message: 'Writing patched files…' });
  }
  onProgress({ fraction: 1, message: 'Done' });
}

function alignUp(n: number, align: number): number {
  return Math.ceil(n / align) * align;
}
