import { useEffect, useState } from 'react';
import { findMesh, findObject, useEditor, type TransformMode } from '../state/store';
import type { Vec3 } from '../model/types';

const MODE_LABEL: Record<TransformMode, string> = {
  translate: 'Move',
  rotate: 'Rotate°',
  scale: 'Scale',
};

const fmt = (v: number) => (Math.abs(v) < 0.0005 ? '0' : v.toFixed(2));

/** Live values while dragging the gizmo. */
export function DragReadout() {
  const readout = useEditor((s) => s.dragReadout);
  if (!readout) return null;
  return (
    <div className="drag-readout">
      <span className="drag-readout-mode">{MODE_LABEL[readout.mode]}</span>
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <span key={axis} className="drag-readout-axis">
          <b>{axis}</b> {fmt(readout.values[i])}
        </span>
      ))}
    </div>
  );
}

/** The dashed rectangle drawn while box-selecting in edit mode. */
export function BoxSelectRect() {
  const rect = useEditor((s) => s.boxSelectRect);
  if (!rect) return null;
  const left = Math.min(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const width = Math.abs(rect.x1 - rect.x0);
  const height = Math.abs(rect.y1 - rect.y0);
  return <div className="box-select-rect" style={{ left, top, width, height }} />;
}

/** Read the current transform vector of the selection for the active mode. */
function currentVector(mode: TransformMode): Vec3 | null {
  const s = useEditor.getState();
  const { selection, doc } = s;
  if (!selection) return null;
  if (selection.kind === 'start') {
    return mode === 'rotate' ? doc.start.rotation : mode === 'scale' ? { x: 1, y: 1, z: 1 } : doc.start.position;
  }
  if (selection.kind === 'mesh') {
    const m = findMesh(doc, selection.id);
    if (!m) return null;
    return mode === 'rotate' ? m.transform.rotation : mode === 'scale' ? m.transform.scale : m.transform.position;
  }
  if (selection.kind === 'object') {
    const o = findObject(doc, selection.id);
    if (!o) return null;
    if (mode === 'scale') return 'scale' in o ? o.scale : { x: 1, y: 1, z: 1 };
    return mode === 'rotate' ? o.rotation : o.position;
  }
  return null;
}

/**
 * Numeric type-to-transform: opened with Enter, edits the selection's
 * position / rotation / scale (for the active gizmo mode) with exact values.
 */
export function NumericTransform() {
  const open = useEditor((s) => s.numericOpen);
  const close = useEditor((s) => s.closeNumeric);
  const mode = useEditor((s) => s.transformMode);
  const selection = useEditor((s) => s.selection);
  const mutate = useEditor((s) => s.mutate);
  const [vec, setVec] = useState<Vec3>({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (open) {
      const v = currentVector(mode);
      if (v) setVec({ x: round(v.x), y: round(v.y), z: round(v.z) });
    }
  }, [open, mode]);

  if (!open || !selection || selection.kind === 'group') return null;

  const apply = () => {
    mutate((doc) => {
      const write = (target: { position: Vec3; rotation: Vec3 }, hasScale: boolean, setScale?: (v: Vec3) => void) => {
        if (mode === 'translate') target.position = { ...vec };
        else if (mode === 'rotate') target.rotation = { ...vec };
        else if (mode === 'scale' && hasScale && setScale) setScale({ ...vec });
      };
      if (selection.kind === 'start') write(doc.start, false);
      else if (selection.kind === 'mesh') {
        const m = doc.meshes.find((x) => x.id === selection.id);
        if (m) write(m.transform, true, (v) => (m.transform.scale = v));
      } else if (selection.kind === 'object') {
        const o = doc.objects.find((x) => x.id === selection.id);
        if (o) write(o, 'scale' in o, (v) => 'scale' in o && (o.scale = v));
      }
    });
    close();
  };

  return (
    <div className="numeric-transform" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <span className="numeric-title">{MODE_LABEL[mode]} — exact</span>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <label key={axis} className="numeric-field">
          <span>{axis.toUpperCase()}</span>
          <input
            autoFocus={axis === 'x'}
            type="number"
            step={mode === 'rotate' ? 15 : 0.25}
            value={vec[axis]}
            onChange={(e) => setVec((p) => ({ ...p, [axis]: parseFloat(e.target.value) || 0 }))}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
          />
        </label>
      ))}
      <button className="active" onClick={apply}>
        Apply
      </button>
      <button onClick={close}>Cancel</button>
    </div>
  );
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
