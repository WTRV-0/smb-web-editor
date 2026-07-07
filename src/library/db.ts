import Dexie, { type EntityTable } from 'dexie';
import type { LevelRecord, LevelSetRecord } from '../model/types';
import { buildExampleStage } from '../model/exampleStage';

class WorkshopDB extends Dexie {
  levels!: EntityTable<LevelRecord, 'id'>;
  levelSets!: EntityTable<LevelSetRecord, 'id'>;

  constructor() {
    super('smb-workshop');
    this.version(1).stores({
      levels: 'id, setId, slot',
      levelSets: 'id, name',
    });
  }
}

export const db = new WorkshopDB();

export const DEFAULT_SET_ID = 'default-set';

export async function ensureDefaultSet(): Promise<void> {
  const existing = await db.levelSets.get(DEFAULT_SET_ID);
  if (!existing) {
    const now = Date.now();
    await db.levelSets.add({
      id: DEFAULT_SET_ID,
      name: 'My Levels',
      description: 'Default level set',
      createdAt: now,
      modifiedAt: now,
    });
    // Seed the showcase stage so a first-time visitor has a rich example to open.
    const example = buildExampleStage();
    await db.levels.add({ id: example.id, setId: DEFAULT_SET_ID, slot: 0, document: example });
  }
}
