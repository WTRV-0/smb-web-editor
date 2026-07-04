import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useEditor } from '../state/store';
import type { EditableMesh, StageMesh } from '../model/types';
import {
  decodeEdge,
  encodeEdge,
  rotateVertices,
  scaleVertices,
  translateVertices,
  uniqueEdges,
} from './editableMesh';

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
  const editTransformMode = useEditor((s) => s.editTransformMode);
  const setDragReadout = useEditor((s) => s.setDragReadout);
  const boxSelectActive = useEditor((s) => s.boxSelectActive);
  const setBoxSelectRect = useEditor((s) => s.setBoxSelectRect);
  const { camera, gl, size } = useThree();
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

  // Box (rectangle) select: capture a drag over the canvas and select every
  // component whose projected screen point lands inside the rectangle.
  useEffect(() => {
    if (!boxSelectActive || !em || !editable) return;
    const el = gl.domElement;
    let start: [number, number] | null = null;
    let shift = false;

    const local = (ev: PointerEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    };
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      start = local(ev);
      shift = ev.shiftKey;
    };
    const onMove = (ev: PointerEvent) => {
      if (!start) return;
      const [x1, y1] = local(ev);
      setBoxSelectRect({ x0: start[0], y0: start[1], x1, y1 });
    };
    const onUp = (ev: PointerEvent) => {
      if (!start) return;
      const [ex, ey] = local(ev);
      const minX = Math.min(start[0], ex);
      const maxX = Math.max(start[0], ex);
      const minY = Math.min(start[1], ey);
      const maxY = Math.max(start[1], ey);
      start = null;
      setBoxSelectRect(null);
      if (maxX - minX < 3 && maxY - minY < 3) return; // treat as a click, not a box

      const meshObj = renderedMesh.current;
      if (!meshObj) return;
      meshObj.updateWorldMatrix(true, false);
      const world = meshObj.matrixWorld;
      const tmp = new THREE.Vector3();
      const toPx = (x: number, y: number, z: number): [number, number] | null => {
        tmp.set(x, y, z).applyMatrix4(world).project(camera);
        if (tmp.z > 1) return null; // behind the camera
        return [((tmp.x + 1) / 2) * size.width, ((1 - tmp.y) / 2) * size.height];
      };
      const inBox = (px: [number, number] | null) =>
        !!px && px[0] >= minX && px[0] <= maxX && px[1] >= minY && px[1] <= maxY;
      const P = editable.positions;
      const picked: number[] = [];
      if (em.mode === 'vertex') {
        for (let i = 0; i < P.length / 3; i++) if (inBox(toPx(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]))) picked.push(i);
      } else if (em.mode === 'edge') {
        for (const key of uniqueEdges(editable)) {
          const [a, b] = decodeEdge(key);
          if (inBox(toPx((P[a * 3] + P[b * 3]) / 2, (P[a * 3 + 1] + P[b * 3 + 1]) / 2, (P[a * 3 + 2] + P[b * 3 + 2]) / 2)))
            picked.push(key);
        }
      } else {
        for (let f = 0; f < editable.faces.length; f++) {
          const loop = editable.faces[f];
          let cx = 0;
          let cy = 0;
          let cz = 0;
          for (const v of loop) {
            cx += P[v * 3];
            cy += P[v * 3 + 1];
            cz += P[v * 3 + 2];
          }
          if (inBox(toPx(cx / loop.length, cy / loop.length, cz / loop.length))) picked.push(f);
        }
      }
      if (shift) setEditSelection([...new Set([...em.selection, ...picked])]);
      else setEditSelection(picked);
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setBoxSelectRect(null);
    };
  }, [boxSelectActive, em, editable, camera, gl, size.width, size.height, renderedMesh, setBoxSelectRect, setEditSelection]);

  if (!em || !editable) return null;

  const pivotArr = (): [number, number, number] => [dragStart.current.x, dragStart.current.y, dragStart.current.z];

  /** Compute the transformed position of a source vertex for the live preview. */
  const transformedPos = (v: number): [number, number, number] => {
    const p: [number, number, number] = [editable.positions[v * 3], editable.positions[v * 3 + 1], editable.positions[v * 3 + 2]];
    if (editTransformMode === 'translate') {
      const d = pivot.position.clone().sub(dragStart.current);
      return [p[0] + d.x, p[1] + d.y, p[2] + d.z];
    }
    const c = pivotArr();
    if (editTransformMode === 'scale') {
      return [
        c[0] + (p[0] - c[0]) * pivot.scale.x,
        c[1] + (p[1] - c[1]) * pivot.scale.y,
        c[2] + (p[2] - c[2]) * pivot.scale.z,
      ];
    }
    // rotate: apply pivot.rotation about centroid
    const e = pivot.rotation;
    const [cx, cy, cz] = [Math.cos(e.x), Math.cos(e.y), Math.cos(e.z)];
    const [sx, sy, sz] = [Math.sin(e.x), Math.sin(e.y), Math.sin(e.z)];
    let x = p[0] - c[0];
    let y = p[1] - c[1];
    let z = p[2] - c[2];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    return [x + c[0], y + c[1], z + c[2]];
  };

  const applyLive = () => {
    const geo = renderedMesh.current?.geometry;
    const attr = geo?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    for (const v of verts) {
      const t = transformedPos(v);
      for (const off of offsets.get(v) ?? []) {
        attr.array[off] = t[0];
        attr.array[off + 1] = t[1];
        attr.array[off + 2] = t[2];
      }
    }
    attr.needsUpdate = true;
    geo?.computeVertexNormals();
    publishReadout();
  };

  const publishReadout = () => {
    if (editTransformMode === 'translate') {
      const d = pivot.position.clone().sub(dragStart.current);
      setDragReadout({ mode: 'translate', values: [d.x, d.y, d.z] });
    } else if (editTransformMode === 'rotate') {
      const DEG = 180 / Math.PI;
      setDragReadout({ mode: 'rotate', values: [pivot.rotation.x * DEG, pivot.rotation.y * DEG, pivot.rotation.z * DEG] });
    } else {
      setDragReadout({ mode: 'scale', values: [pivot.scale.x, pivot.scale.y, pivot.scale.z] });
    }
  };

  const beginDrag = () => {
    dragStart.current.copy(centroid); // centroid is the pivot for all modes
    pivot.position.copy(centroid);
    pivot.rotation.set(0, 0, 0);
    pivot.scale.set(1, 1, 1);
    captureSnapshot();
    setDragging(true);
    publishReadout();
  };

  const commitDrag = () => {
    setDragReadout(null);
    const c = pivotArr();
    if (editTransformMode === 'translate') {
      const delta = pivot.position.clone().sub(dragStart.current);
      if (delta.lengthSq() > 1e-12) {
        applyEditOp((m) => ({ mesh: translateVertices(m, verts, delta.x, delta.y, delta.z), selection: em.selection }), {
          captureHistory: false,
        });
      }
    } else if (editTransformMode === 'rotate') {
      const e = pivot.rotation;
      if (e.x || e.y || e.z) {
        applyEditOp((m) => ({ mesh: rotateVertices(m, verts, c, [e.x, e.y, e.z]), selection: em.selection }), {
          captureHistory: false,
        });
      }
    } else {
      const s = pivot.scale;
      if (s.x !== 1 || s.y !== 1 || s.z !== 1) {
        applyEditOp((m) => ({ mesh: scaleVertices(m, verts, c, [s.x, s.y, s.z]), selection: em.selection }), {
          captureHistory: false,
        });
      }
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

      {/* transform gizmo at the selection centroid (mode from editTransformMode) */}
      {verts.length > 0 && (
        <>
          <primitive object={pivot} />
          <TransformControls
            object={pivot}
            mode={editTransformMode}
            size={0.7}
            onMouseDown={beginDrag}
            onObjectChange={applyLive}
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
