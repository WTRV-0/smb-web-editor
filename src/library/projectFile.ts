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

/** .smbstage file: a single shareable stage. */
export interface StageFile {
  format: 'smbstage';
  version: 1;
  document: StageDocument;
  thumbnail?: string;
  /** free-form attribution the author can fill in */
  author?: string;
}

/** Minimal structural validation so a bad/foreign file fails loudly, not silently. */
function assertStageDocument(doc: unknown): asserts doc is StageDocument {
  const d = doc as Partial<StageDocument>;
  if (!d || typeof d !== 'object') throw new Error('Missing stage document.');
  if (!Array.isArray(d.meshes) || !Array.isArray(d.objects) || !Array.isArray(d.itemGroups)) {
    throw new Error('Stage document is malformed (missing meshes/objects/groups).');
  }
  if (!d.start || typeof d.name !== 'string') throw new Error('Stage document is malformed (missing start/name).');
}

/** Fill in fields that may be absent on documents from older app versions. */
function migrateDocument(doc: StageDocument): StageDocument {
  return {
    ...doc,
    version: 1,
    timeLimit: doc.timeLimit ?? 60,
    falloutY: doc.falloutY ?? -10,
    background: doc.background ?? 'jungle',
    musicId: doc.musicId ?? 36,
    textures: doc.textures ?? [],
    itemGroups: doc.itemGroups.length ? doc.itemGroups : [{ id: 'static', name: 'Static', rotationCenter: { x: 0, y: 0, z: 0 } }],
  };
}

export function exportStageFile(doc: StageDocument, thumbnail?: string): Blob {
  const data: StageFile = { format: 'smbstage', version: 1, document: doc, thumbnail };
  return new Blob([JSON.stringify(data, null, 0)], { type: 'application/json' });
}

/** Import a single stage into a set; returns the new level's document id. */
export async function importStageFile(file: File, setId: string): Promise<string> {
  const parsed = JSON.parse(await file.text());
  if (parsed?.format !== 'smbstage') throw new Error('Not a .smbstage file.');
  assertStageDocument(parsed.document);
  const document = migrateDocument({ ...(parsed.document as StageDocument), id: newId() });
  const slot = await db.levels.where('setId').equals(setId).count();
  await db.levels.add({ id: document.id, setId, slot, document, thumbnail: parsed.thumbnail });
  return document.id;
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
  if (!Array.isArray(data.levels) || !data.set) throw new Error('Level pack is malformed.');
  const now = Date.now();
  const setId = newId();
  await db.levelSets.add({ ...data.set, id: setId, name: `${data.set.name} (imported)`, modifiedAt: now });
  const records: LevelRecord[] = data.levels.map((l) => {
    assertStageDocument(l.document);
    const document = migrateDocument({ ...l.document, id: newId() });
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
