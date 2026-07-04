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

Files per stage slot NNN (Super Monkey Ball 2, GameCube):
  STAGENNN.lz  - stage definition (collision + objects), LZSS compressed
  stNNN.gma    - stage models
  stNNN.tpl    - stage textures

To play in Dolphin, insert these into your legally-dumped SMB2 ISO's "stage"
directory, replacing the stock files for that slot, using GCRebuilder
(Windows) or "gcmtool"/other GC filesystem tools. Then open the rebuilt ISO
in Dolphin and select the stage in Challenge mode.

Slot numbers: 201+ correspond to Challenge mode Beginner 1+; see the SMB2
modding community docs for the full slot table.

An in-app ISO patcher is planned so this manual step goes away.
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
