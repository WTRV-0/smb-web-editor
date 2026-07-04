import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useEditor } from '../state/store';
import type { EditableMesh, StageMesh } from '../model/types';
import { decodeEdge, encodeEdge, translateVertices, uniqueEdges } from './editableMesh';

const VERT_COLOR = new THREE.Color('#1f2937');
const VERT_SELECTED = new THREE.Color('#facc15');

/** Vertices affected by the current component selection. */
export function selectedVertices(editable: EditableMesh, mode: 'vertex' | 'edge' | 'face', selection: number[]): number[] {
  const verts = new Set<number>();
  if (mode === 'vertex') selection.forEach((v) => verts.add(v));
  else if (mode === 'edge') {
    for (const key of selection) {
      const [a, b] = decodeEdge(key);
      verts.add(a);
      verts.add(b);
    }
  } else {
    for (const f of selection) {
      for (const v of editable.faces[f] ?? []) verts.add(v);
    }
  }
  return [...verts];
}

/** Map vertex id -> float offsets (xyz starts) inside the triangulated position buffer. */
function vertexOffsets(editable: EditableMesh): Map<number, number[]> {
  const map = new Map<number, number[]>();
  let tri = 0;
  for (const loop of editable.faces) {
    for (let i = 1; i < loop.length - 1; i++) {
      const corners = [loop[0], loop[i], loop[i + 1]];
      for (let k = 0; k < 3; k++) {
        const off = (tri * 3 + k) * 3;
        const list = map.get(corners[k]);
        if (list) list.push(off);
        else map.set(corners[k], [off]);
      }
      tri++;
    }
  }
  return map;
}

export function EditModeOverlay({
  mesh,
  renderedMesh,
}: {
  mesh: StageMesh;
  renderedMesh: React.RefObject<THREE.Mesh | null>;
}) {
  const em = useEditor((s) => s.editMode);
  const setEditSelection = useEditor((s) => s.setEditSelection);
  const captureSnapshot = useEditor((s) => s.captureSnapshot);
  const applyEditOp = useEditor((s) => s.applyEditOp);
  const [dragging, setDragging] = useState(false);
  const pivot = useMemo(() => new THREE.Object3D(), []);
  const dragStart = useRef(new THREE.Vector3());
  const spheresRef = useRef<THREE.InstancedMesh>(null);

  const editable = mesh.source.type === 'editable' ? mesh.source.mesh : null;

  const verts = useMemo(
    () => (editable && em ? selectedVertices(editable, em.mode, em.selection) : []),
    [editable, em?.mode, em?.selection],
  );

  const offsets = useMemo(() => (editable ? vertexOffsets(editable) : new Map<number, number[]>()), [editable]);

  const centroid = useMemo(() => {
    const c = new THREE.Vector3();
    if (!editable || verts.length === 0) return c;
    for (const v of verts) {
      c.x += editable.positions[v * 3];
      c.y += editable.positions[v * 3 + 1];
      c.z += editable.positions[v * 3 + 2];
    }
    return c.divideScalar(verts.length);
  }, [editable, verts]);

  // edge line geometry (all edges + selected edges)
  const edgeGeometry = useMemo(() => {
    if (!editable) return null;
    const edges = uniqueEdges(editable);
    const all = new Float32Array(edges.length * 6);
    const selectedSet = new Set(em?.mode === 'edge' ? em.selection : []);
    const sel: number[] = [];
    edges.forEach((key, i) => {
      const [a, b] = decodeEdge(key);
      for (let k = 0; k < 3; k++) {
        all[i * 6 + k] = editable.positions[a * 3 + k];
        all[i * 6 + 3 + k] = editable.positions[b * 3 + k];
      }
      if (selectedSet.has(key)) {
        for (let k = 0; k < 6; k++) sel.push(all[i * 6 + k]);
      }
    });
    const allGeo = new THREE.BufferGeometry();
    allGeo.setAttribute('position', new THREE.BufferAttribute(all, 3));
    const selGeo = new THREE.BufferGeometry();
    selGeo.setAttribute('position', new THREE.Float32BufferAttribute(sel, 3));
    return { allGeo, selGeo };
  }, [editable, em?.mode, em?.selection]);
  useEffect(
    () => () => {
      edgeGeometry?.allGeo.dispose();
      edgeGeometry?.selGeo.dispose();
    },
    [edgeGeometry],
  );

  // selected face highlight geometry
  const faceHighlight = useMemo(() => {
    if (!editable || em?.mode !== 'face' || em.selection.length === 0) return null;
    const positions: number[] = [];
    for (const f of em.selection) {
      const loop = editable.faces[f];
      if (!loop) continue;
      for (let i = 1; i < loop.length - 1; i++) {
        for (const v of [loop[0], loop[i], loop[i + 1]]) {
          positions.push(editable.positions[v * 3], editable.positions[v * 3 + 1], editable.positions[v * 3 + 2]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [editable, em?.mode, em?.selection]);
  useEffect(() => () => faceHighlight?.dispose(), [faceHighlight]);

  // vertex handle instances
  useEffect(() => {
    const inst = spheresRef.current;
    if (!inst || !editable) return;
    const m = new THREE.Matrix4();
    const selectedSet = new Set(em?.mode === 'vertex' ? em.selection : []);
    const count = editable.positions.length / 3;
    for (let v = 0; v < count; v++) {
      m.makeTranslation(editable.positions[v * 3], editable.positions[v * 3 + 1], editable.positions[v * 3 + 2]);
      inst.setMatrixAt(v, m);
      inst.setColorAt(v, selectedSet.has(v) ? VERT_SELECTED : VERT_COLOR);
    }
    inst.count = count;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [editable, em?.mode, em?.selection]);

  useEffect(() => {
    if (!dragging) pivot.position.copy(centroid);
  }, [pivot, centroid, dragging]);

  if (!em || !editable) return null;

  const applyLiveDelta = (delta: THREE.Vector3) => {
    const geo = renderedMesh.current?.geometry;
    const attr = geo?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    for (const v of verts) {
      for (const off of offsets.get(v) ?? []) {
        attr.array[off] = editable.positions[v * 3] + delta.x;
        attr.array[off + 1] = editable.positions[v * 3 + 1] + delta.y;
        attr.array[off + 2] = editable.positions[v * 3 + 2] + delta.z;
      }
    }
    attr.needsUpdate = true;
    geo?.computeVertexNormals();
  };

  const commitDrag = () => {
    const delta = pivot.position.clone().sub(dragStart.current);
    if (delta.lengthSq() > 1e-12) {
      applyEditOp((m) => ({ mesh: translateVertices(m, verts, delta.x, delta.y, delta.z), selection: em.selection }), {
        captureHistory: false, // snapshot was captured on drag start
      });
    }
  };

  return (
    <group>
      {/* vertex handles (vertex mode) */}
      {em.mode === 'vertex' && (
        <instancedMesh
          ref={spheresRef}
          args={[undefined, undefined, Math.max(editable.positions.length / 3, 1)]}
          visible={!dragging}
          onClick={(e) => {
            e.stopPropagation();
            if (e.instanceId === undefined) return;
            const cur = new Set(em.selection);
            if (e.shiftKey) {
              if (cur.has(e.instanceId)) cur.delete(e.instanceId);
              else cur.add(e.instanceId);
              setEditSelection([...cur]);
            } else {
              setEditSelection([e.instanceId]);
            }
          }}
        >
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      )}

      {/* edges */}
      {edgeGeometry && !dragging && (
        <>
          <lineSegments geometry={edgeGeometry.allGeo}>
            <lineBasicMaterial color="#64748b" transparent opacity={0.7} depthTest={false} />
          </lineSegments>
          <lineSegments geometry={edgeGeometry.selGeo}>
            <lineBasicMaterial color="#facc15" linewidth={2} depthTest={false} />
          </lineSegments>
        </>
      )}

      {/* selected face highlight */}
      {faceHighlight && !dragging && (
        <mesh geometry={faceHighlight}>
          <meshBasicMaterial
            color="#facc15"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-2}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* translate gizmo at the selection centroid */}
      {verts.length > 0 && (
        <>
          <primitive object={pivot} />
          <TransformControls
            object={pivot}
            mode="translate"
            size={0.7}
            onMouseDown={() => {
              dragStart.current.copy(pivot.position);
              captureSnapshot();
              setDragging(true);
            }}
            onObjectChange={() => applyLiveDelta(pivot.position.clone().sub(dragStart.current))}
            onMouseUp={() => {
              setDragging(false);
              commitDrag();
            }}
          />
        </>
      )}
    </group>
  );
}

/** Pick the nearest edge (encoded key) of a face loop to a local-space point. */
export function nearestEdgeOfFace(editable: EditableMesh, faceId: number, point: THREE.Vector3): number | null {
  const loop = editable.faces[faceId];
  if (!loop) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const line = new THREE.Line3();
  for (let i = 0; i < loop.length; i++) {
    const va = loop[i];
    const vb = loop[(i + 1) % loop.length];
    a.fromArray(editable.positions, va * 3);
    b.fromArray(editable.positions, vb * 3);
    line.set(a, b);
    line.closestPointToPoint(point, true, tmp);
    const d = tmp.distanceToSquared(point);
    if (d < bestDist) {
      bestDist = d;
      best = encodeEdge(va, vb);
    }
  }
  return best;
}

/** Pick the nearest vertex of a face loop to a local-space point. */
export function nearestVertexOfFace(editable: EditableMesh, faceId: number, point: THREE.Vector3): number | null {
  const loop = editable.faces[faceId];
  if (!loop) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const v of loop) {
    const dx = editable.positions[v * 3] - point.x;
    const dy = editable.positions[v * 3 + 1] - point.y;
    const dz = editable.positions[v * 3 + 2] - point.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}
