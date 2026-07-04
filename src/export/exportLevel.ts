import { zipSync } from 'fflate';
import type { StageDocument } from '../model/types';
import { writeStageDef } from '../formats/stagedef/write';
import { lzCompress } from '../formats/lz/lzss';
import { writeGma } from '../formats/gma/write';
import { writeTpl } from '../formats/tpl/write';
import { buildExport } from './buildExport';
import { decodeTextures } from './decodeTextures';
import { downloadBlob } from '../library/projectFile';

export interface StageFiles {
  lz: Uint8Array;
  gma: Uint8Array;
  tpl: Uint8Array;
}

/** Produce the three game files for one level. */
export async function buildStageFiles(doc: StageDocument): Promise<StageFiles> {
  const decoded = await decodeTextures(doc);
  const { stageDef, gmaModels, tplTextures } = buildExport(doc, decoded);
  const raw = writeStageDef(stageDef);
  return {
    lz: lzCompress(raw),
    gma: writeGma(gmaModels),
    tpl: writeTpl(tplTextures),
  };
}

const README = `Monkey Ball Workshop export
===========================

Files per stage number NNN (Super Monkey Ball 2, GameCube):
  STAGENNN.lz  - stage definition (collision + objects), LZSS compressed
  stNNN.gma    - stage models
  stNNN.tpl    - stage textures

Stage files are numbered containers; WHICH file the game loads for a given
menu slot is decided by course tables inside mkb2.main_loop.rel. These
exports are numbered for the vanilla STORY MODE slots (Story 1-1 = STAGE201,
1-2 = 202, 1-3 = 203, 1-4 = 204, 1-5 = STAGE001, ... - the vanilla table is
irregular). Challenge mode reuses the same stage pool, so replacing a story
stage also replaces any challenge slot that references the same stage id.

To play in Dolphin, replace the matching files inside your legally-dumped
SMB2 ISO (GCRebuilder or similar), or skip this zip entirely and use the
app's "Patch ISO" button, which assigns slots by name and patches a copy of
your ISO in the browser.
`;

/** Zip one or more levels (documents paired with stage slot numbers). */
export async function exportLevelsAsZip(
  levels: { doc: StageDocument; slot: number }[],
  zipName: string,
): Promise<void> {
  const files: Record<string, Uint8Array> = { 'README.txt': new TextEncoder().encode(README) };
  for (const { doc, slot } of levels) {
    const id = String(slot).padStart(3, '0');
    const stage = await buildStageFiles(doc);
    files[`STAGE${id}.lz`] = stage.lz;
    files[`st${id}.gma`] = stage.gma;
    files[`st${id}.tpl`] = stage.tpl;
  }
  const zipped = zipSync(files, { level: 6 });
  downloadBlob(new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' }), zipName);
}
