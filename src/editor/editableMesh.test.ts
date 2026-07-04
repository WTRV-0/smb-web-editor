import { describe, expect, it } from 'vitest';
import {
  extrudeFaces,
  importedToEditable,
  mergeVertices,
  primitiveToEditable,
  rotateVertices,
  scaleVertices,
  signedVolume,
  subdivideFaces,
  deleteFaces,
  translateVertices,
  triangulate,
  triangleCount,
  uniqueEdges,
  vertexCount,
} from './editableMesh';
import type { EditableMesh, PrimitiveParams } from '../model/types';

/** Closed manifold invariant: every undirected edge is used by exactly 2 faces. */
function isClosedManifold(mesh: EditableMesh): boolean {
  const use = new Map<string, number>();
  for (const loop of mesh.faces) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      use.set(k, (use.get(k) ?? 0) + 1);
    }
  }
  return [...use.values()].every((n) => n === 2);
}

function noNaN(mesh: EditableMesh): boolean {
  return mesh.positions.every((v) => Number.isFinite(v));
}

describe('primitive generators', () => {
  const seg = 32;
  const cases: { params: PrimitiveParams; volume: number; tolerance: number }[] = [
    { params: { kind: 'box', width: 4, height: 2, depth: 3 }, volume: 24, tolerance: 1e-6 },
    { params: { kind: 'ramp', width: 4, height: 2, depth: 3 }, volume: 12, tolerance: 1e-6 },
    { params: { kind: 'wedge', width: 4, height: 2, depth: 3 }, volume: 12, tolerance: 1e-6 },
    { params: { kind: 'cylinder', width: 4, height: 2, depth: 4, segments: seg }, volume: Math.PI * 4 * 2, tolerance: 0.02 },
    { params: { kind: 'cone', radius: 2, height: 3, segments: seg }, volume: (Math.PI / 3) * 4 * 3, tolerance: 0.02 },
    {
      params: { kind: 'torus', majorRadius: 4, minorRadius: 1, segmentsU: seg, segmentsV: 16 },
      volume: 2 * Math.PI * 4 * Math.PI * 1,
      tolerance: 0.05,
    },
    {
      params: { kind: 'arcRamp', innerRadius: 6, width: 3, sweep: 90, thickness: 0.5, bank: 20, segments: seg },
      volume: 0.5 * 3 * Math.cos((20 * Math.PI) / 180) * (Math.PI / 2) * (6 + (3 * Math.cos((20 * Math.PI) / 180)) / 2),
      tolerance: 0.05,
    },
    // stairs: sum of step boxes = w * run/steps * rise/steps * (1+2+...+steps)
    { params: { kind: 'stairs', width: 4, rise: 2, run: 4, steps: 8 }, volume: 4 * 2 * 4 * (9 / 16), tolerance: 1e-6 },
    {
      params: { kind: 'tube', radius: 3, thickness: 0.5, sweep: 180, length: 8, segments: seg },
      volume: 0.5 * Math.PI * (9 - 2.5 * 2.5) * 8,
      tolerance: 0.05,
    },
    {
      params: { kind: 'tube', radius: 3, thickness: 0.5, sweep: 360, length: 8, segments: seg },
      volume: Math.PI * (9 - 2.5 * 2.5) * 8,
      tolerance: 0.05,
    },
    {
      params: { kind: 'funnel', topRadius: 4, bottomRadius: 1.5, height: 3, thickness: 0.5, segments: seg },
      // frustum(4,1.5) - frustum(3.5,1.0)
      volume:
        (Math.PI / 3) * 3 * (16 + 4 * 1.5 + 2.25) - (Math.PI / 3) * 3 * (12.25 + 3.5 + 1),
      tolerance: 0.05,
    },
  ];

  for (const c of cases) {
    it(`${c.params.kind} is a closed, outward-wound solid with the right volume`, () => {
      const mesh = primitiveToEditable(c.params);
      expect(noNaN(mesh)).toBe(true);
      expect(triangleCount(mesh)).toBeGreaterThan(0);
      expect(isClosedManifold(mesh)).toBe(true);
      const vol = signedVolume(mesh);
      expect(vol).toBeGreaterThan(0);
      const relError = Math.abs(vol - c.volume) / c.volume;
      expect(relError).toBeLessThan(Math.max(c.tolerance, 1e-6) + 1e-9);
    });
  }
});

describe('edit operations', () => {
  const box = () => primitiveToEditable({ kind: 'box', width: 2, height: 2, depth: 2 });

  it('extrude keeps the mesh closed and grows volume when pulled', () => {
    const { mesh, movedFaceIds, newVertexIds } = extrudeFaces(box(), [0]); // top face
    expect(isClosedManifold(mesh)).toBe(true);
    expect(signedVolume(mesh)).toBeCloseTo(8, 5); // unchanged until moved
    expect(newVertexIds).toHaveLength(4);
    const pulled = translateVertices(mesh, newVertexIds, 0, 1, 0);
    expect(signedVolume(pulled)).toBeCloseTo(8 + 4, 5); // + face area * 1
    expect(isClosedManifold(pulled)).toBe(true);
    expect(movedFaceIds).toEqual([0]);
  });

  it('extruding two adjacent faces builds walls only on the region boundary', () => {
    const m = box();
    const { mesh, newVertexIds } = extrudeFaces(m, [0, 2]); // top + front share an edge
    expect(isClosedManifold(mesh)).toBe(true);
    // shared edge must not get a wall: region of 2 quads has 6 boundary edges
    expect(mesh.faces.length).toBe(6 + 6);
    expect(newVertexIds.length).toBe(6);
  });

  it('subdivide stays crack-free and preserves volume', () => {
    const { mesh, newFaceIds } = subdivideFaces(box(), [0]);
    expect(newFaceIds).toHaveLength(4);
    expect(mesh.faces.length).toBe(9); // 5 originals (4 stitched) + 4 new quads
    expect(isClosedManifold(mesh)).toBe(true);
    expect(signedVolume(mesh)).toBeCloseTo(8, 5);
  });

  it('subdividing everything quadruples faces', () => {
    const all = box().faces.map((_, i) => i);
    const { mesh } = subdivideFaces(box(), all);
    expect(mesh.faces.length).toBe(24);
    expect(isClosedManifold(mesh)).toBe(true);
    expect(signedVolume(mesh)).toBeCloseTo(8, 5);
  });

  it('deleteFaces drops faces and orphaned vertices', () => {
    const mesh = deleteFaces(box(), [0]);
    expect(mesh.faces.length).toBe(5);
    expect(vertexCount(mesh)).toBe(8); // top verts still used by side walls
    const open = deleteFaces(box(), [0, 2, 3, 4, 5]);
    expect(open.faces.length).toBe(1);
    expect(vertexCount(open)).toBe(4); // only the bottom quad's verts remain
  });

  it('mergeVertices collapses and drops degenerate faces', () => {
    const m = box();
    // merge the whole top face into one point -> top quad degenerates away
    const top = [...m.faces[0]];
    const merged = mergeVertices(m, top);
    expect(merged.faces.length).toBe(5);
    expect(merged.faces.every((f) => f.length >= 3)).toBe(true);
    expect(noNaN(merged)).toBe(true);
  });

  it('rotates a full box about its center without changing volume', () => {
    const m = box();
    const allVerts = [...Array(vertexCount(m)).keys()];
    const rotated = rotateVertices(m, allVerts, [0, 0, 0], [0, Math.PI / 2, 0]);
    expect(noNaN(rotated)).toBe(true);
    expect(Math.abs(signedVolume(rotated))).toBeCloseTo(8, 4);
    expect(isClosedManifold(rotated)).toBe(true);
  });

  it('rotating the whole box 90° about Y maps a +X corner toward -Z', () => {
    const m = box(); // 2x2x2 centered
    const allVerts = [...Array(vertexCount(m)).keys()];
    const rotated = rotateVertices(m, allVerts, [0, 0, 0], [0, Math.PI / 2, 0]);
    // some vertex must now sit near (0,*, -? )... check a corner (1,*,1) -> (1,*,-1) under Rz*Ry*Rx here
    const moved = [];
    for (let v = 0; v < vertexCount(rotated); v++) {
      moved.push([rotated.positions[v * 3], rotated.positions[v * 3 + 2]]);
    }
    // all corners keep |x|=|z|=1, just permuted
    expect(moved.every(([x, z]) => Math.abs(Math.abs(x) - 1) < 1e-6 && Math.abs(Math.abs(z) - 1) < 1e-6)).toBe(true);
  });

  it('scales the whole box about its center', () => {
    const m = box();
    const allVerts = [...Array(vertexCount(m)).keys()];
    const scaled = scaleVertices(m, allVerts, [0, 0, 0], [2, 1, 3]);
    expect(signedVolume(scaled)).toBeCloseTo(8 * 2 * 1 * 3, 4);
    expect(isClosedManifold(scaled)).toBe(true);
  });

  it('welds imported duplicate vertices into shared topology', () => {
    const mesh = importedToEditable({
      positions: [0, 0, 0, 1, 0, 0, 0, 0, 1, /* dup tri */ 1, 0, 0, 1, 0, 1, 0, 0, 1.00000001],
      normals: [],
      indices: [0, 1, 2, 3, 4, 5],
    });
    expect(vertexCount(mesh)).toBe(4);
    expect(mesh.faces).toHaveLength(2);
    expect(uniqueEdges(mesh).length).toBe(5);
  });

  it('triangulate produces a face map aligned with triangles', () => {
    const { positions, faceMap } = triangulate(box());
    expect(positions.length).toBe(12 * 9);
    expect(faceMap).toHaveLength(12);
    expect(faceMap[0]).toBe(0);
    expect(faceMap[11]).toBe(5);
  });
});
