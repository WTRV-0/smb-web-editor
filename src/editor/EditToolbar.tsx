import { useEditor, type EditComponentMode } from '../state/store';
import {
  deleteFaces,
  extrudeFaces,
  flipFaces,
  mergeVertices,
  subdivideFaces,
  decodeEdge,
  uniqueEdges,
} from './editableMesh';
import type { EditableMesh } from '../model/types';

const MODES: { mode: EditComponentMode; label: string; key: string }[] = [
  { mode: 'vertex', label: 'Vertex', key: '1' },
  { mode: 'edge', label: 'Edge', key: '2' },
  { mode: 'face', label: 'Face', key: '3' },
];

/** Faces that contain any of the given vertices. */
function facesTouchingVerts(mesh: EditableMesh, verts: Set<number>): number[] {
  return mesh.faces.flatMap((loop, i) => (loop.some((v) => verts.has(v)) ? [i] : []));
}

export function editSelectAll(): void {
  const s = useEditor.getState();
  const em = s.editMode;
  const mesh = s.doc.meshes.find((m) => m.id === em?.meshId);
  if (!em || !mesh || mesh.source.type !== 'editable') return;
  const editable = mesh.source.mesh;
  const all =
    em.mode === 'vertex'
      ? [...Array(editable.positions.length / 3).keys()]
      : em.mode === 'edge'
        ? uniqueEdges(editable)
        : editable.faces.map((_, i) => i);
  s.setEditSelection(em.selection.length === all.length ? [] : all);
}

export function editExtrude(): void {
  const s = useEditor.getState();
  const em = s.editMode;
  if (!em || em.mode !== 'face' || em.selection.length === 0) return;
  s.applyEditOp((m) => {
    const r = extrudeFaces(m, em.selection);
    return { mesh: r.mesh, selection: r.movedFaceIds };
  });
}

export function editDeleteComponents(): void {
  const s = useEditor.getState();
  const em = s.editMode;
  if (!em || em.selection.length === 0) return;
  s.applyEditOp((m) => {
    let faces: number[];
    if (em.mode === 'face') faces = em.selection;
    else if (em.mode === 'vertex') faces = facesTouchingVerts(m, new Set(em.selection));
    else {
      const verts = new Set<number>();
      for (const k of em.selection) {
        const [a, b] = decodeEdge(k);
        verts.add(a);
        verts.add(b);
      }
      faces = m.faces.flatMap((loop, i) => {
        for (let j = 0; j < loop.length; j++) {
          const a = loop[j];
          const b = loop[(j + 1) % loop.length];
          if (verts.has(a) && verts.has(b)) return [i];
        }
        return [];
      });
    }
    return { mesh: deleteFaces(m, faces), selection: [] };
  });
}

export function EditToolbar() {
  const em = useEditor((s) => s.editMode);
  const doc = useEditor((s) => s.doc);
  const setMode = useEditor((s) => s.setEditComponentMode);
  const applyEditOp = useEditor((s) => s.applyEditOp);
  const exitEditMode = useEditor((s) => s.exitEditMode);
  const editTransformMode = useEditor((s) => s.editTransformMode);
  const setEditTransformMode = useEditor((s) => s.setEditTransformMode);
  const boxSelectActive = useEditor((s) => s.boxSelectActive);
  const toggleBoxSelect = useEditor((s) => s.toggleBoxSelect);

  if (!em) return null;
  const mesh = doc.meshes.find((m) => m.id === em.meshId);
  if (!mesh || mesh.source.type !== 'editable') return null;
  const hasSelection = em.selection.length > 0;

  return (
    <div className="edit-toolbar">
      <span className="edit-toolbar-title">✏ {mesh.name}</span>
      <div className="btn-group">
        {MODES.map((m) => (
          <button
            key={m.mode}
            className={em.mode === m.mode ? 'active' : ''}
            title={`${m.label} select (${m.key})`}
            onClick={() => setMode(m.mode)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="btn-group">
        {(['translate', 'rotate', 'scale'] as const).map((tm) => (
          <button
            key={tm}
            className={editTransformMode === tm ? 'active' : ''}
            title={`${tm} (${tm === 'translate' ? 'G' : tm === 'rotate' ? 'R' : 'S'})`}
            onClick={() => setEditTransformMode(tm)}
          >
            {tm === 'translate' ? 'Move' : tm === 'rotate' ? 'Rot' : 'Scale'}
          </button>
        ))}
      </div>
      <button
        className={boxSelectActive ? 'active' : ''}
        title="Box select — drag a rectangle to select components (B)"
        onClick={toggleBoxSelect}
      >
        ▧ Box
      </button>
      <button disabled={em.mode !== 'face' || !hasSelection} onClick={editExtrude} title="Extrude selected faces (E), then drag">
        Extrude
      </button>
      <button
        disabled={em.mode !== 'face' || !hasSelection}
        title="Subdivide selected faces"
        onClick={() =>
          applyEditOp((m) => {
            const r = subdivideFaces(m, em.selection);
            return { mesh: r.mesh, selection: r.newFaceIds };
          })
        }
      >
        Subdivide
      </button>
      <button
        disabled={em.mode !== 'vertex' || em.selection.length < 2}
        title="Merge selected vertices at their center"
        onClick={() => applyEditOp((m) => ({ mesh: mergeVertices(m, em.selection), selection: [] }))}
      >
        Merge
      </button>
      <button
        disabled={!hasSelection}
        title="Delete selected components (Del)"
        onClick={editDeleteComponents}
      >
        Delete
      </button>
      <button
        title="Flip normals of selected faces (or all if none selected)"
        onClick={() =>
          applyEditOp((m) => ({
            mesh: flipFaces(m, em.mode === 'face' && hasSelection ? em.selection : undefined),
            selection: em.selection,
          }))
        }
      >
        Flip
      </button>
      <button title="Select all / none (A)" onClick={editSelectAll}>
        All
      </button>
      <div className="spacer" />
      <button className="active" onClick={exitEditMode} title="Exit edit mode (Tab)">
        Done
      </button>
    </div>
  );
}
