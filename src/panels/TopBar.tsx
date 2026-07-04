import { useMemo } from 'react';
import { useEditor, type TransformMode } from '../state/store';
import { exportLevelsAsZip } from '../export/exportLevel';
import { buildGeometry } from '../editor/meshGeometry';
import { HelpButton } from './HelpOverlay';
import { IsoPatcherButton } from './IsoPatcher';

function TriangleCounter() {
  const meshes = useEditor((s) => s.doc.meshes);
  const total = useMemo(
    () =>
      meshes.reduce((sum, m) => {
        if (!m.visible) return sum;
        const g = buildGeometry(m);
        const n = g.getAttribute('position').count / 3;
        g.dispose();
        return sum + n;
      }, 0),
    [meshes],
  );
  return (
    <span className="save-state" title="Collision triangles in the stage — keep this reasonable for file size and performance">
      ▲ {total}
    </span>
  );
}

const MODES: { mode: TransformMode; label: string; key: string }[] = [
  { mode: 'translate', label: 'Move', key: 'W' },
  { mode: 'rotate', label: 'Rotate', key: 'E' },
  { mode: 'scale', label: 'Scale', key: 'R' },
];

export function TopBar() {
  const doc = useEditor((s) => s.doc);
  const saveState = useEditor((s) => s.saveState);
  const transformMode = useEditor((s) => s.transformMode);
  const setTransformMode = useEditor((s) => s.setTransformMode);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const toggleSnap = useEditor((s) => s.toggleSnap);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const newDocument = useEditor((s) => s.newDocument);
  const setLibraryOpen = useEditor((s) => s.setLibraryOpen);

  return (
    <div className="topbar">
      <span className="brand">🐒 Monkey Ball Workshop</span>
      <span className="doc-name">{doc.name}</span>
      <span className={`save-state save-${saveState}`}>
        {saveState === 'saved' ? '✓ saved' : saveState === 'saving' ? 'saving…' : '● unsaved'}
      </span>
      <TriangleCounter />
      <div className="spacer" />
      <div className="btn-group">
        {MODES.map((m) => (
          <button
            key={m.mode}
            className={transformMode === m.mode ? 'active' : ''}
            onClick={() => setTransformMode(m.mode)}
            title={`${m.label} (${m.key})`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button className={snapEnabled ? 'active' : ''} onClick={toggleSnap} title="Toggle snapping (S)">
        Snap
      </button>
      <div className="btn-group">
        <button disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
          ↩
        </button>
        <button disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">
          ↪
        </button>
      </div>
      <div className="spacer" />
      <button onClick={newDocument}>New Level</button>
      <button onClick={() => setLibraryOpen(true)}>Library</button>
      <button
        title="Export this level as SMB2 stage files (STAGE201 = vanilla Story 1-1)"
        onClick={() => {
          exportLevelsAsZip([{ doc, slot: 201 }], `${doc.name}.zip`).catch((err) =>
            alert(`Export failed: ${err instanceof Error ? err.message : err}`),
          );
        }}
      >
        Export
      </button>
      <IsoPatcherButton />
      <HelpButton />
    </div>
  );
}
