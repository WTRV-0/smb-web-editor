import type { LevelRecord, LevelSetRecord, StageDocument } from '../model/types';
import { newId } from '../model/defaults';
import { db } from './db';

/** .smbproj file: a level set plus its levels, portable across browsers/machines. */
export interface ProjectFile {
  format: 'smbproj';
  version: 1;
  set: LevelSetRecord;
  levels: { slot: number; document: StageDocument; thumbnail?: string }[];
}

export async function exportSetAsProject(setId: string): Promise<Blob> {
  const set = await db.levelSets.get(setId);
  if (!set) throw new Error('Level set not found');
  const levels = await db.levels.where('setId').equals(setId).sortBy('slot');
  const data: ProjectFile = {
    format: 'smbproj',
    version: 1,
    set,
    levels: levels.map((l) => ({ slot: l.slot, document: l.document, thumbnail: l.thumbnail })),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

/** Import a .smbproj as a NEW set (ids regenerated to avoid collisions). */
export async function importProject(file: File): Promise<string> {
  const data = JSON.parse(await file.text()) as ProjectFile;
  if (data.format !== 'smbproj') throw new Error('Not a .smbproj file');
  const now = Date.now();
  const setId = newId();
  await db.levelSets.add({ ...data.set, id: setId, name: `${data.set.name} (imported)`, modifiedAt: now });
  const records: LevelRecord[] = data.levels.map((l) => {
    const document = { ...l.document, id: newId() };
    return { id: document.id, setId, slot: l.slot, document, thumbnail: l.thumbnail };
  });
  await db.levels.bulkAdd(records);
  return setId;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
