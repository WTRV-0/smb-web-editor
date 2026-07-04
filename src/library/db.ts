import Dexie, { type EntityTable } from 'dexie';
import type { LevelRecord, LevelSetRecord } from '../model/types';

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
  }
}
