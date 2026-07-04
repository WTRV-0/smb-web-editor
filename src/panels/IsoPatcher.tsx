import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaultSet } from '../library/db';
import { useEditor } from '../state/store';
import { buildStageFiles } from '../export/exportLevel';
import { patchIso, type ReplacementFile } from '../formats/gciso/patch';

export function IsoPatcherButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Patch your SMB2 ISO with levels from a set">
        Patch ISO
      </button>
      {open && <IsoPatcherModal onClose={() => setOpen(false)} />}
    </>
  );
}

function IsoPatcherModal({ onClose }: { onClose: () => void }) {
  const currentSetId = useEditor((s) => s.setId);
  const [setId, setSetId] = useState(currentSetId);
  const [baseSlot, setBaseSlot] = useState(201);
  const [iso, setIso] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ fraction: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isoInput = useRef<HTMLInputElement>(null);

  const sets = useLiveQuery(async () => {
    await ensureDefaultSet();
    return db.levelSets.orderBy('name').toArray();
  }, []);
  const levelCount = useLiveQuery(() => db.levels.where('setId').equals(setId).count(), [setId]) ?? 0;

  const supported = typeof window.showSaveFilePicker === 'function';

  const run = async () => {
    if (!iso) return;
    setError(null);
    try {
      // Ask for the output location first (must happen in the user gesture)
      const outHandle = await window.showSaveFilePicker({
        suggestedName: iso.name.replace(/\.iso$/i, '') + '-patched.iso',
        types: [{ description: 'GameCube ISO', accept: { 'application/octet-stream': ['.iso'] } }],
      });
      setBusy(true);

      setProgress({ fraction: 0, message: 'Building stage files…' });
      const levels = await db.levels.where('setId').equals(setId).sortBy('slot');
      const replacements: ReplacementFile[] = [];
      for (let i = 0; i < levels.length; i++) {
        const slot = String(baseSlot + i).padStart(3, '0');
        const stage = await buildStageFiles(levels[i].document);
        replacements.push({ name: `STAGE${slot}.lz`, data: stage.lz });
        replacements.push({ name: `st${slot}.gma`, data: stage.gma });
        replacements.push({ name: `st${slot}.tpl`, data: stage.tpl });
      }

      const writable = await outHandle.createWritable();
      try {
        await patchIso(iso, writable, replacements, setProgress);
        await writable.close();
      } catch (err) {
        await writable.abort();
        throw err;
      }
      setProgress({ fraction: 1, message: '✅ Patched ISO written. Open it in Dolphin!' });
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err));
      }
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-content">
          <h2>Patch SMB2 ISO</h2>
          {!supported && (
            <p className="error-text">
              This feature needs the File System Access API — use a Chromium-based browser (Chrome, Edge, Brave).
            </p>
          )}
          <p>
            Replaces Challenge-mode stages in your legally-dumped SMB2 ISO with the levels of a set. Your original ISO
            is not modified; a patched copy is written where you choose.
          </p>
          <label className="field field-wide">
            <span>Level set</span>
            <select value={setId} onChange={(e) => setSetId(e.target.value)} disabled={busy}>
              {(sets ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-wide">
            <span>First slot</span>
            <input
              type="number"
              min={201}
              max={420}
              value={baseSlot}
              disabled={busy}
              onChange={(e) => setBaseSlot(parseInt(e.target.value) || 201)}
            />
          </label>
          <p className="hint">
            {levelCount} level(s) → slots {baseSlot}–{baseSlot + Math.max(levelCount - 1, 0)} (201 = Challenge
            Beginner 1).
          </p>
          <label className="field field-wide">
            <span>SMB2 ISO</span>
            <button disabled={busy} onClick={() => isoInput.current?.click()}>
              {iso ? iso.name : 'Choose ISO…'}
            </button>
            <input
              ref={isoInput}
              type="file"
              accept=".iso,.gcm"
              hidden
              onChange={(e) => setIso(e.target.files?.[0] ?? null)}
            />
          </label>
          {progress && (
            <div className="patch-progress">
              <div className="patch-progress-bar" style={{ width: `${progress.fraction * 100}%` }} />
              <span>{progress.message}</span>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
        </div>
        <div className="modal-actions">
          <button disabled={busy} onClick={onClose}>
            Close
          </button>
          <button disabled={!iso || busy || levelCount === 0 || !supported} className="active" onClick={() => void run()}>
            {busy ? 'Patching…' : 'Patch'}
          </button>
        </div>
      </div>
    </div>
  );
}
