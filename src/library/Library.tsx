import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SET_ID, ensureDefaultSet } from './db';
import { downloadBlob, exportSetAsProject, exportStageFile, importProject, importStageFile } from './projectFile';
import { exportLevelsAsZip } from '../export/exportLevel';
import { STORY_SLOTS } from '../formats/gciso/slots';
import { BrandMark, GamepadIcon } from '../ui/icons';
import { useEditor } from '../state/store';
import { newId, newStageDocument } from '../model/defaults';
import type { LevelRecord } from '../model/types';

export function Library() {
  const setLibraryOpen = useEditor((s) => s.setLibraryOpen);
  const loadDocument = useEditor((s) => s.loadDocument);
  const currentSetId = useEditor((s) => s.setId);
  const [selectedSetId, setSelectedSetId] = useState(currentSetId);
  const [search, setSearch] = useState('');
  const importInput = useRef<HTMLInputElement>(null);
  const stageInput = useRef<HTMLInputElement>(null);

  const sets = useLiveQuery(async () => {
    await ensureDefaultSet();
    return db.levelSets.orderBy('name').toArray();
  }, []);
  const levels = useLiveQuery(
    () => db.levels.where('setId').equals(selectedSetId).sortBy('slot'),
    [selectedSetId],
  );

  const filtered = (levels ?? []).filter((l) =>
    l.document.name.toLowerCase().includes(search.toLowerCase()),
  );

  const createSet = async () => {
    const name = prompt('Level set name?', 'New Level Set');
    if (!name) return;
    const now = Date.now();
    const id = newId();
    await db.levelSets.add({ id, name, description: '', createdAt: now, modifiedAt: now });
    setSelectedSetId(id);
  };

  const renameSet = async (id: string, current: string) => {
    const name = prompt('Rename set', current);
    if (name && name !== current) await db.levelSets.update(id, { name, modifiedAt: Date.now() });
  };

  const deleteSet = async (id: string) => {
    if (id === DEFAULT_SET_ID) {
      alert('The default set cannot be deleted.');
      return;
    }
    const count = await db.levels.where('setId').equals(id).count();
    if (!confirm(`Delete this set and its ${count} level(s)? This cannot be undone.`)) return;
    await db.levels.where('setId').equals(id).delete();
    await db.levelSets.delete(id);
    if (selectedSetId === id) setSelectedSetId(DEFAULT_SET_ID);
  };

  const createLevel = async () => {
    const doc = newStageDocument();
    const count = await db.levels.where('setId').equals(selectedSetId).count();
    await db.levels.add({ id: doc.id, setId: selectedSetId, slot: count, document: doc });
    loadDocument(doc, selectedSetId);
  };

  const duplicateLevel = async (level: LevelRecord) => {
    const doc = structuredClone(level.document);
    doc.id = newId();
    doc.name = `${doc.name} (copy)`;
    doc.modifiedAt = Date.now();
    const count = await db.levels.where('setId').equals(selectedSetId).count();
    await db.levels.add({ id: doc.id, setId: selectedSetId, slot: count, document: doc, thumbnail: level.thumbnail });
  };

  const deleteLevel = async (level: LevelRecord) => {
    if (!confirm(`Delete "${level.document.name}"?`)) return;
    await db.levels.delete(level.id);
  };

  const moveLevel = async (level: LevelRecord, dir: -1 | 1) => {
    const list = await db.levels.where('setId').equals(selectedSetId).sortBy('slot');
    const i = list.findIndex((l) => l.id === level.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    await db.transaction('rw', db.levels, async () => {
      await db.levels.update(list[i].id, { slot: j });
      await db.levels.update(list[j].id, { slot: i });
    });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      setSelectedSetId(await importProject(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const onImportStage = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importStageFile(file, selectedSetId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => setLibraryOpen(false)}>
      <div className="modal library-modal" onClick={(e) => e.stopPropagation()}>
        <div className="library-sidebar">
          <div className="library-sidebar-header">
            <h3>Level Sets</h3>
            <button className="icon-btn" onClick={createSet} title="New level set">
              ＋
            </button>
          </div>
          {(sets ?? []).map((set) => (
            <div
              key={set.id}
              className={`set-row ${set.id === selectedSetId ? 'selected' : ''}`}
              onClick={() => setSelectedSetId(set.id)}
            >
              <span className="set-name">{set.name}</span>
              <span className="set-actions">
                <button className="icon-btn" title="Rename" onClick={(e) => (e.stopPropagation(), void renameSet(set.id, set.name))}>
                  ✎
                </button>
                <button
                  className="icon-btn"
                  title="Export set (.smbproj)"
                  onClick={async (e) => {
                    e.stopPropagation();
                    downloadBlob(await exportSetAsProject(set.id), `${set.name}.smbproj`);
                  }}
                >
                  ⭳
                </button>
                <button
                  className="icon-btn"
                  title="Export set as SMB2 stage files (slots 201+)"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const list = await db.levels.where('setId').equals(set.id).sortBy('slot');
                    if (list.length === 0) {
                      alert('This set has no levels.');
                      return;
                    }
                    await exportLevelsAsZip(
                      list.map((l, i) => ({ doc: l.document, slot: STORY_SLOTS[i]?.stageId ?? 0 })).filter((x) => x.slot),
                      `${set.name}-stages.zip`,
                    ).catch((err) => alert(`Export failed: ${err instanceof Error ? err.message : err}`));
                  }}
                >
                  <GamepadIcon size={14} />
                </button>
                <button className="icon-btn" title="Delete set" onClick={(e) => (e.stopPropagation(), void deleteSet(set.id))}>
                  ✕
                </button>
              </span>
            </div>
          ))}
          <button className="library-import" onClick={() => importInput.current?.click()}>
            Import .smbproj…
          </button>
          <input
            ref={importInput}
            type="file"
            accept=".smbproj,application/json"
            hidden
            onChange={(e) => {
              void onImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div className="library-content">
          <div className="library-content-header">
            <input
              type="search"
              placeholder="Search levels…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={createLevel}>＋ New Level</button>
            <button onClick={() => stageInput.current?.click()} title="Import a shared stage (.smbstage)">
              Import Stage
            </button>
            <input
              ref={stageInput}
              type="file"
              accept=".smbstage,application/json"
              hidden
              onChange={(e) => {
                void onImportStage(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button className="icon-btn modal-close" onClick={() => setLibraryOpen(false)} title="Close">
              ✕
            </button>
          </div>
          <div className="level-grid">
            {filtered.map((level, i) => (
              <div key={level.id} className="level-card">
                <div
                  className="level-thumb"
                  onClick={() => loadDocument(structuredClone(level.document), selectedSetId)}
                  title="Open in editor"
                >
                  {level.thumbnail ? (
                    <img src={level.thumbnail} alt="" />
                  ) : (
                    <span className="thumb-placeholder">
                      <BrandMark size={40} />
                    </span>
                  )}
                </div>
                <div className="level-card-body">
                  <span className="level-name">
                    {i + 1}. {level.document.name}
                  </span>
                  <span className="level-actions">
                    <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => void moveLevel(level, -1)}>
                      ↑
                    </button>
                    <button
                      className="icon-btn"
                      title="Move down"
                      disabled={i === filtered.length - 1}
                      onClick={() => void moveLevel(level, 1)}
                    >
                      ↓
                    </button>
                    <button className="icon-btn" title="Duplicate" onClick={() => void duplicateLevel(level)}>
                      ⧉
                    </button>
                    <button
                      className="icon-btn"
                      title="Download stage (.smbstage) to share"
                      onClick={() =>
                        downloadBlob(
                          exportStageFile(level.document, level.thumbnail),
                          `${level.document.name}.smbstage`,
                        )
                      }
                    >
                      ⭳
                    </button>
                    <button className="icon-btn" title="Delete" onClick={() => void deleteLevel(level)}>
                      ✕
                    </button>
                  </span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="hint">No levels here yet — create one!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
