import { findFile, parseFst, readDiscHeader } from './fst';

/**
 * Read one file's bytes out of a GameCube ISO by name (via the disc FST).
 * Used to pull a stock stage's TPL from the user's own ISO so its textures can
 * be copied into a custom stage. Reads only the bytes needed.
 */
export async function readIsoFile(iso: File, name: string): Promise<Uint8Array | null> {
  const header = new Uint8Array(await iso.slice(0, 0x440).arrayBuffer());
  const { fstOffset, fstSize } = readDiscHeader(header);
  if (fstOffset === 0 || fstOffset + fstSize > iso.size) return null;
  const fst = new Uint8Array(await iso.slice(fstOffset, fstOffset + fstSize).arrayBuffer());
  const entry = findFile(parseFst(fst), name);
  if (!entry) return null;
  return new Uint8Array(await iso.slice(entry.offset, entry.offset + entry.length).arrayBuffer());
}

/** List stage numbers present in the ISO (st###.tpl files) for the texture browser. */
export async function listStageTpls(iso: File): Promise<number[]> {
  const header = new Uint8Array(await iso.slice(0, 0x440).arrayBuffer());
  const { fstOffset, fstSize } = readDiscHeader(header);
  if (fstOffset === 0 || fstOffset + fstSize > iso.size) return [];
  const fst = new Uint8Array(await iso.slice(fstOffset, fstOffset + fstSize).arrayBuffer());
  const nums = new Set<number>();
  for (const f of parseFst(fst)) {
    const m = /(?:^|\/)st(\d{3})\.tpl$/i.exec(f.path);
    if (m) nums.add(parseInt(m[1], 10));
  }
  return [...nums].sort((a, b) => a - b);
}
