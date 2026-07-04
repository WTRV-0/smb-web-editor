/**
 * Editable polygon mesh: generation, conversion, and Blender-style edit ops.
 *
 * Conventions: faces are convex polygon loops wound CCW viewed from outside;
 * fan triangulation from the first loop vertex; Y up; closed solids have
 * positive signed volume (asserted in tests to catch winding mistakes).
 * All ops are pure — they return new meshes so undo/redo via document
 * snapshots keeps working.
 */

import type { EditableMesh, ImportedGeometry, PrimitiveParams } from '../model/types';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

export function cloneMesh(mesh: EditableMesh): EditableMesh {
  return { positions: [...mesh.positions], faces: mesh.faces.map((f) => [...f]) };
}

export function vertexCount(mesh: EditableMesh): number {
  return mesh.positions.length / 3;
}

export function triangleCount(mesh: EditableMesh): number {
  return mesh.faces.reduce((a, f) => a + Math.max(f.length - 2, 0), 0);
}

/** Fan-triangulate into a non-indexed position array + face id per triangle. */
export function triangulate(mesh: EditableMesh): { positions: Float32Array; faceMap: number[] } {
  const positions = new Float32Array(triangleCount(mesh) * 9);
  const faceMap: number[] = [];
  let o = 0;
  const put = (v: number) => {
    positions[o++] = mesh.positions[v * 3];
    positions[o++] = mesh.positions[v * 3 + 1];
    positions[o++] = mesh.positions[v * 3 + 2];
  };
  for (let f = 0; f < mesh.faces.length; f++) {
    const loop = mesh.faces[f];
    for (let i = 1; i < loop.length - 1; i++) {
      put(loop[0]);
      put(loop[i]);
      put(loop[i + 1]);
      faceMap.push(f);
    }
  }
  return { positions, faceMap };
}

/** Signed volume via divergence theorem; positive when faces are wound outward. */
export function signedVolume(mesh: EditableMesh): number {
  const { positions } = triangulate(mesh);
  let v = 0;
  for (let t = 0; t < positions.length; t += 9) {
    const ax = positions[t],
      ay = positions[t + 1],
      az = positions[t + 2];
    const bx = positions[t + 3],
      by = positions[t + 4],
      bz = positions[t + 5];
    const cx = positions[t + 6],
      cy = positions[t + 7],
      cz = positions[t + 8];
    v += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

export function faceNormal(mesh: EditableMesh, faceId: number): [number, number, number] {
  const loop = mesh.faces[faceId];
  // Newell's method — robust for polygons
  let nx = 0,
    ny = 0,
    nz = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] * 3;
    const b = loop[(i + 1) % loop.length] * 3;
    nx += (mesh.positions[a + 1] - mesh.positions[b + 1]) * (mesh.positions[a + 2] + mesh.positions[b + 2]);
    ny += (mesh.positions[a + 2] - mesh.positions[b + 2]) * (mesh.positions[a] + mesh.positions[b]);
    nz += (mesh.positions[a] - mesh.positions[b]) * (mesh.positions[a + 1] + mesh.positions[b + 1]);
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

export function faceCentroid(mesh: EditableMesh, faceId: number): [number, number, number] {
  const loop = mesh.faces[faceId];
  let x = 0,
    y = 0,
    z = 0;
  for (const v of loop) {
    x += mesh.positions[v * 3];
    y += mesh.positions[v * 3 + 1];
    z += mesh.positions[v * 3 + 2];
  }
  return [x / loop.length, y / loop.length, z / loop.length];
}

// Edge keys pack a sorted vertex pair into one number (meshes stay << 1e6 verts)
export const encodeEdge = (a: number, b: number): number => (a < b ? a * 1_000_000 + b : b * 1_000_000 + a);
export const decodeEdge = (key: number): [number, number] => [Math.floor(key / 1_000_000), key % 1_000_000];

/** All unique undirected edges. */
export function uniqueEdges(mesh: EditableMesh): number[] {
  const seen = new Set<number>();
  for (const loop of mesh.faces) {
    for (let i = 0; i < loop.length; i++) {
      seen.add(encodeEdge(loop[i], loop[(i + 1) % loop.length]));
    }
  }
  return [...seen];
}

// ---------------------------------------------------------------------------
// Edit operations
// ---------------------------------------------------------------------------

export function translateVertices(mesh: EditableMesh, verts: number[], dx: number, dy: number, dz: number): EditableMesh {
  const next = cloneMesh(mesh);
  for (const v of verts) {
    next.positions[v * 3] += dx;
    next.positions[v * 3 + 1] += dy;
    next.positions[v * 3 + 2] += dz;
  }
  return next;
}

/**
 * Region extrude: selected faces get fresh vertices; walls are built along the
 * region boundary. New vertices start at the old positions (drag to pull out).
 */
export function extrudeFaces(
  mesh: EditableMesh,
  faceIds: number[],
): { mesh: EditableMesh; movedFaceIds: number[]; newVertexIds: number[] } {
  const next = cloneMesh(mesh);
  const selected = new Set(faceIds);

  // boundary detection: edges used by exactly one selected face
  const edgeUse = new Map<number, number>();
  for (const f of faceIds) {
    const loop = next.faces[f];
    for (let i = 0; i < loop.length; i++) {
      const k = encodeEdge(loop[i], loop[(i + 1) % loop.length]);
      edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1);
    }
  }

  const dup = new Map<number, number>();
  const duplicated = (v: number): number => {
    let d = dup.get(v);
    if (d === undefined) {
      d = vertexCount(next);
      next.positions.push(next.positions[v * 3], next.positions[v * 3 + 1], next.positions[v * 3 + 2]);
      dup.set(v, d);
    }
    return d;
  };

  const walls: number[][] = [];
  for (const f of faceIds) {
    const loop = next.faces[f];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (edgeUse.get(encodeEdge(a, b)) === 1) {
        walls.push([a, b, duplicated(b), duplicated(a)]);
      }
    }
    next.faces[f] = loop.map(duplicated);
  }
  void selected;
  for (const w of walls) next.faces.push(w);

  const gc = gcVertices(next);
  return {
    mesh: gc.mesh,
    movedFaceIds: faceIds,
    newVertexIds: [...dup.values()].map((v) => gc.remap[v]).filter((v) => v !== -1),
  };
}

/**
 * Linear subdivide: each selected face splits into quads around its centroid
 * using shared edge midpoints. Unselected neighbors get the midpoint inserted
 * into their loop so the surface stays crack-free.
 */
export function subdivideFaces(mesh: EditableMesh, faceIds: number[]): { mesh: EditableMesh; newFaceIds: number[] } {
  const next = cloneMesh(mesh);
  const selected = new Set(faceIds);

  const midpoints = new Map<number, number>();
  const midpoint = (a: number, b: number): number => {
    const k = encodeEdge(a, b);
    let m = midpoints.get(k);
    if (m === undefined) {
      m = vertexCount(next);
      next.positions.push(
        (next.positions[a * 3] + next.positions[b * 3]) / 2,
        (next.positions[a * 3 + 1] + next.positions[b * 3 + 1]) / 2,
        (next.positions[a * 3 + 2] + next.positions[b * 3 + 2]) / 2,
      );
      midpoints.set(k, m);
    }
    return m;
  };

  const newFaceIds: number[] = [];
  const replacements = new Map<number, number[][]>();
  for (const f of faceIds) {
    const loop = next.faces[f];
    const n = loop.length;
    // centroid vertex
    const c = vertexCount(next);
    const [cx, cy, cz] = faceCentroid(next, f);
    next.positions.push(cx, cy, cz);
    const faces: number[][] = [];
    for (let i = 0; i < n; i++) {
      const vi = loop[i];
      const mNext = midpoint(vi, loop[(i + 1) % n]);
      const mPrev = midpoint(loop[(i - 1 + n) % n], vi);
      faces.push([vi, mNext, c, mPrev]);
    }
    replacements.set(f, faces);
  }

  // stitch midpoints into unselected neighbors
  for (let f = 0; f < next.faces.length; f++) {
    if (selected.has(f)) continue;
    const loop = next.faces[f];
    const stitched: number[] = [];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      stitched.push(a);
      const m = midpoints.get(encodeEdge(a, b));
      if (m !== undefined) stitched.push(m);
    }
    next.faces[f] = stitched;
  }

  // apply replacements: first quad replaces the face, the rest append
  for (const [f, faces] of replacements) {
    next.faces[f] = faces[0];
    newFaceIds.push(f);
    for (let i = 1; i < faces.length; i++) {
      newFaceIds.push(next.faces.length);
      next.faces.push(faces[i]);
    }
  }
  return { mesh: next, newFaceIds };
}

export function deleteFaces(mesh: EditableMesh, faceIds: number[]): EditableMesh {
  const drop = new Set(faceIds);
  const next: EditableMesh = {
    positions: [...mesh.positions],
    faces: mesh.faces.filter((_, i) => !drop.has(i)).map((f) => [...f]),
  };
  return gcVertices(next).mesh;
}

export function mergeVertices(mesh: EditableMesh, verts: number[]): EditableMesh {
  if (verts.length < 2) return mesh;
  const next = cloneMesh(mesh);
  const target = Math.min(...verts);
  let x = 0,
    y = 0,
    z = 0;
  for (const v of verts) {
    x += next.positions[v * 3];
    y += next.positions[v * 3 + 1];
    z += next.positions[v * 3 + 2];
  }
  next.positions[target * 3] = x / verts.length;
  next.positions[target * 3 + 1] = y / verts.length;
  next.positions[target * 3 + 2] = z / verts.length;

  const merged = new Set(verts);
  next.faces = next.faces
    .map((loop) => {
      const mapped = loop.map((v) => (merged.has(v) ? target : v));
      // drop consecutive duplicates (including wrap-around)
      const out: number[] = [];
      for (let i = 0; i < mapped.length; i++) {
        if (mapped[i] !== mapped[(i + 1) % mapped.length]) out.push(mapped[i]);
      }
      return out;
    })
    .filter((loop) => new Set(loop).size >= 3 && loop.length >= 3);
  return gcVertices(next).mesh;
}

export function flipFaces(mesh: EditableMesh, faceIds?: number[]): EditableMesh {
  const next = cloneMesh(mesh);
  const which = faceIds ?? next.faces.map((_, i) => i);
  for (const f of which) next.faces[f] = [...next.faces[f]].reverse();
  return next;
}

/** Drop unreferenced vertices; returns the compacted mesh + old→new map (-1 = dropped). */
export function gcVertices(mesh: EditableMesh): { mesh: EditableMesh; remap: number[] } {
  const used = new Set<number>();
  for (const loop of mesh.faces) for (const v of loop) used.add(v);
  const remap = new Array<number>(vertexCount(mesh)).fill(-1);
  const positions: number[] = [];
  let n = 0;
  for (let v = 0; v < remap.length; v++) {
    if (used.has(v)) {
      remap[v] = n++;
      positions.push(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
    }
  }
  return {
    mesh: { positions, faces: mesh.faces.map((loop) => loop.map((v) => remap[v])) },
    remap,
  };
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/** Weld duplicated vertices and turn triangles into faces. */
export function importedToEditable(geom: ImportedGeometry, epsilon = 1e-4): EditableMesh {
  const keyOf = (x: number, y: number, z: number) =>
    `${Math.round(x / epsilon)},${Math.round(y / epsilon)},${Math.round(z / epsilon)}`;
  const index = new Map<string, number>();
  const positions: number[] = [];
  const weldMap: number[] = [];
  for (let v = 0; v < geom.positions.length / 3; v++) {
    const x = geom.positions[v * 3];
    const y = geom.positions[v * 3 + 1];
    const z = geom.positions[v * 3 + 2];
    const key = keyOf(x, y, z);
    let w = index.get(key);
    if (w === undefined) {
      w = positions.length / 3;
      positions.push(x, y, z);
      index.set(key, w);
    }
    weldMap.push(w);
  }
  const faces: number[][] = [];
  for (let i = 0; i < geom.indices.length; i += 3) {
    const a = weldMap[geom.indices[i]];
    const b = weldMap[geom.indices[i + 1]];
    const c = weldMap[geom.indices[i + 2]];
    if (a !== b && b !== c && a !== c) faces.push([a, b, c]);
  }
  return { positions, faces };
}

// ---------------------------------------------------------------------------
// Primitive generators (quad topology, outward winding)
// ---------------------------------------------------------------------------

export function primitiveToEditable(params: PrimitiveParams): EditableMesh {
  switch (params.kind) {
    case 'box':
      return boxMesh(-params.width / 2, -params.height / 2, -params.depth / 2, params.width / 2, params.height / 2, params.depth / 2);
    case 'ramp':
      return rampMesh(params.width, params.height, params.depth);
    case 'wedge':
      return wedgeMesh(params.width, params.height, params.depth);
    case 'cylinder':
      return cylinderMesh(params.width / 2, params.height, params.segments ?? 24);
    case 'cone':
      return coneMesh(params.radius, params.height, params.segments);
    case 'torus':
      return torusMesh(params.majorRadius, params.minorRadius, params.segmentsU, params.segmentsV);
    case 'arcRamp':
      return arcRampMesh(params.innerRadius, params.width, params.sweep, params.thickness, params.bank, params.segments);
    case 'stairs':
      return stairsMesh(params.width, params.rise, params.run, params.steps);
    case 'tube':
      return tubeMesh(params.radius, params.thickness, params.sweep, params.length, params.segments);
    case 'funnel':
      return funnelMesh(params.topRadius, params.bottomRadius, params.height, params.thickness, params.segments);
  }
}

function boxMesh(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): EditableMesh {
  const mesh: EditableMesh = { positions: [], faces: [] };
  addBox(mesh, x0, y0, z0, x1, y1, z1);
  return mesh;
}

/** Append an axis-aligned box (8 verts, 6 outward quads) to a mesh. */
function addBox(mesh: EditableMesh, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  const b = vertexCount(mesh);
  // bottom 0-3 (y0), top 4-7 (y1)
  mesh.positions.push(
    x0, y0, z0,  x1, y0, z0,  x1, y0, z1,  x0, y0, z1,
    x0, y1, z0,  x1, y1, z0,  x1, y1, z1,  x0, y1, z1,
  );
  mesh.faces.push(
    [b + 7, b + 6, b + 5, b + 4], // top (+y)
    [b + 0, b + 1, b + 2, b + 3], // bottom (-y)
    [b + 3, b + 2, b + 6, b + 7], // front (+z)
    [b + 1, b + 0, b + 4, b + 5], // back (-z)
    [b + 2, b + 1, b + 5, b + 6], // right (+x)
    [b + 0, b + 3, b + 7, b + 4], // left (-x)
  );
}

/** Slope descending toward +z, matching the original ramp primitive. */
function rampMesh(w: number, h: number, d: number): EditableMesh {
  const x = w / 2;
  // profile (y,z): low front, low back, high back
  const p = [
    [-h / 2, d / 2],
    [-h / 2, -d / 2],
    [h / 2, -d / 2],
  ];
  const positions: number[] = [];
  for (const [y, z] of p) positions.push(x, y, z); // right cap 0-2
  for (const [y, z] of p) positions.push(-x, y, z); // left cap 3-5
  return {
    positions,
    faces: [
      [0, 1, 2], // right (+x)
      [3, 5, 4], // left (-x)
      [3, 4, 1, 0], // bottom
      [4, 5, 2, 1], // back
      [5, 3, 0, 2], // slope
    ],
  };
}

/** Triangular footprint extruded vertically. */
function wedgeMesh(w: number, h: number, d: number): EditableMesh {
  const foot = [
    [-w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ];
  const positions: number[] = [];
  for (const [x, z] of foot) positions.push(x, h / 2, z); // top 0-2
  for (const [x, z] of foot) positions.push(x, -h / 2, z); // bottom 3-5
  return {
    positions,
    faces: [
      [0, 1, 2], // top
      [3, 5, 4], // bottom
      [3, 4, 1, 0],
      [4, 5, 2, 1],
      [5, 3, 0, 2],
    ],
  };
}

function cylinderMesh(r: number, h: number, seg: number): EditableMesh {
  const positions: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    positions.push(Math.cos(a) * r, h / 2, Math.sin(a) * r); // top ring 0..seg-1
  }
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    positions.push(Math.cos(a) * r, -h / 2, Math.sin(a) * r); // bottom ring
  }
  const faces: number[][] = [];
  faces.push([...Array(seg).keys()].reverse()); // top cap (reversed ring = outward +y)
  faces.push([...Array(seg).keys()].map((i) => seg + i)); // bottom cap
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    faces.push([i, j, seg + j, seg + i]); // side, outward
  }
  return { positions, faces };
}

function coneMesh(r: number, h: number, seg: number): EditableMesh {
  const positions: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    positions.push(Math.cos(a) * r, -h / 2, Math.sin(a) * r);
  }
  positions.push(0, h / 2, 0); // apex = seg
  const faces: number[][] = [];
  faces.push([...Array(seg).keys()]); // base (-y): ring order is outward for -y
  for (let i = 0; i < seg; i++) {
    faces.push([i, seg, (i + 1) % seg]);
  }
  return { positions, faces };
}

function torusMesh(R: number, r: number, segU: number, segV: number): EditableMesh {
  const positions: number[] = [];
  for (let u = 0; u < segU; u++) {
    const a = (u / segU) * TAU;
    for (let v = 0; v < segV; v++) {
      const b = (v / segV) * TAU;
      const rad = R + r * Math.cos(b);
      positions.push(Math.cos(a) * rad, r * Math.sin(b), Math.sin(a) * rad);
    }
  }
  const idx = (u: number, v: number) => ((u + segU) % segU) * segV + ((v + segV) % segV);
  const faces: number[][] = [];
  for (let u = 0; u < segU; u++) {
    for (let v = 0; v < segV; v++) {
      faces.push([idx(u, v), idx(u, v + 1), idx(u + 1, v + 1), idx(u + 1, v)]);
    }
  }
  const mesh: EditableMesh = { positions, faces };
  return signedVolume(mesh) < 0 ? flipFaces(mesh) : mesh;
}

/** Banked circular arc track — the SMB curved-ramp staple. */
function arcRampMesh(innerR: number, width: number, sweepDeg: number, thickness: number, bankDeg: number, seg: number): EditableMesh {
  const sweep = Math.min(Math.max(sweepDeg, 1), 360) * DEG;
  const bank = bankDeg * DEG;
  const positions: number[] = [];
  // 4 verts per station: innerTop, outerTop, outerBottom, innerBottom
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * sweep;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const outR = innerR + width * Math.cos(bank);
    const outY = width * Math.sin(bank);
    positions.push(dx * innerR, 0, dz * innerR);
    positions.push(dx * outR, outY, dz * outR);
    positions.push(dx * outR, outY - thickness, dz * outR);
    positions.push(dx * innerR, -thickness, dz * innerR);
  }
  const faces: number[][] = [];
  const at = (i: number, k: number) => i * 4 + k;
  for (let i = 0; i < seg; i++) {
    // section loop 0→1→2→3 swept between stations i and i+1
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      faces.push([at(i, k), at(i, k2), at(i + 1, k2), at(i + 1, k)]);
    }
  }
  faces.push([at(0, 0), at(0, 1), at(0, 2), at(0, 3)].reverse()); // start cap
  faces.push([at(seg, 0), at(seg, 1), at(seg, 2), at(seg, 3)]); // end cap
  const mesh: EditableMesh = { positions, faces };
  return signedVolume(mesh) < 0 ? flipMeshConsistent(mesh) : mesh;
}

function stairsMesh(w: number, rise: number, run: number, steps: number): EditableMesh {
  const mesh: EditableMesh = { positions: [], faces: [] };
  const stepRise = rise / steps;
  const stepRun = run / steps;
  for (let i = 0; i < steps; i++) {
    addBox(
      mesh,
      -w / 2,
      -rise / 2,
      run / 2 - (i + 1) * stepRun,
      w / 2,
      -rise / 2 + (i + 1) * stepRise,
      run / 2 - i * stepRun,
    );
  }
  return mesh;
}

/** Tube / half-pipe: circular-arc cross-section with wall thickness, along Z. */
function tubeMesh(r: number, thickness: number, sweepDeg: number, length: number, seg: number): EditableMesh {
  const sweep = Math.min(Math.max(sweepDeg, 10), 360) * DEG;
  const closed = sweepDeg >= 360;
  const rIn = Math.max(r - thickness, 0.01);
  const start = -Math.PI / 2 - sweep / 2; // sweep centered on the bottom
  const n = closed ? seg : seg + 1;
  const positions: number[] = [];
  const zA = length / 2;
  const zB = -length / 2;
  // rings: outerA(0..n-1), innerA, outerB, innerB
  for (const [radius, z] of [
    [r, zA],
    [rIn, zA],
    [r, zB],
    [rIn, zB],
  ] as const) {
    for (let k = 0; k < n; k++) {
      const a = start + (k / seg) * sweep;
      positions.push(Math.cos(a) * radius, Math.sin(a) * radius, z);
    }
  }
  const OA = 0,
    IA = n,
    OB = 2 * n,
    IB = 3 * n;
  const faces: number[][] = [];
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const k2 = (k + 1) % n;
    faces.push([OA + k, OB + k, OB + k2, OA + k2]); // outer surface
    faces.push([IA + k, IA + k2, IB + k2, IB + k]); // inner surface
    faces.push([OA + k, OA + k2, IA + k2, IA + k]); // +z cap ring
    faces.push([OB + k, IB + k, IB + k2, OB + k2]); // -z cap ring
  }
  if (!closed) {
    faces.push([OA + 0, IA + 0, IB + 0, OB + 0]); // start lip
    const e = n - 1;
    faces.push([OA + e, OB + e, IB + e, IA + e]); // end lip
  }
  const mesh: EditableMesh = { positions, faces };
  return signedVolume(mesh) < 0 ? flipMeshConsistent(mesh) : mesh;
}

/** Open funnel (lathe of a slanted wall with thickness). bottomRadius > thickness. */
function funnelMesh(topR: number, bottomR: number, h: number, thickness: number, seg: number): EditableMesh {
  const positions: number[] = [];
  const rings: [number, number][] = [
    [topR, h / 2], // outer top
    [bottomR, -h / 2], // outer bottom
    [Math.max(bottomR - thickness, 0.01), -h / 2], // inner bottom
    [Math.max(topR - thickness, 0.01), h / 2], // inner top
  ];
  for (const [radius, y] of rings) {
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * TAU;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
    }
  }
  const faces: number[][] = [];
  const at = (ring: number, k: number) => ring * seg + ((k + seg) % seg);
  for (let k = 0; k < seg; k++) {
    // section loop: outerTop → outerBottom → innerBottom → innerTop
    for (let ring = 0; ring < 4; ring++) {
      const r2 = (ring + 1) % 4;
      faces.push([at(ring, k), at(r2, k), at(r2, k + 1), at(ring, k + 1)]);
    }
  }
  const mesh: EditableMesh = { positions, faces };
  return signedVolume(mesh) < 0 ? flipMeshConsistent(mesh) : mesh;
}

/** Flip every face — valid orientation fix for consistently-wound closed meshes. */
function flipMeshConsistent(mesh: EditableMesh): EditableMesh {
  return flipFaces(mesh);
}
