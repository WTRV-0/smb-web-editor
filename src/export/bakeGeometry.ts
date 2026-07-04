import * as THREE from 'three';
import type { StageMesh } from '../model/types';
import { buildGeometry } from '../editor/meshGeometry';
import type { GmaVertex } from '../formats/gma/write';

const DEG = Math.PI / 180;

export interface BakedMesh {
  /** group-space triangle soup, 9 floats per triangle (collision) */
  triangles: Float32Array;
  /** same triangles as GMA vertices with normals and UVs (visual) */
  vertices: GmaVertex[];
}

/** Bake a stage mesh's local transform into triangle/vertex data. */
export function bakeMesh(mesh: StageMesh): BakedMesh {
  const geometry = buildGeometry(mesh);
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = nonIndexed.getAttribute('position') as THREE.BufferAttribute;
  let nor = nonIndexed.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!nor) {
    nonIndexed.computeVertexNormals();
    nor = nonIndexed.getAttribute('normal') as THREE.BufferAttribute;
  }
  const uv = nonIndexed.getAttribute('uv') as THREE.BufferAttribute | undefined;

  const { position: p, rotation: r, scale: s } = mesh.transform;
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x * DEG, r.y * DEG, r.z * DEG, 'XYZ')),
    new THREE.Vector3(s.x, s.y, s.z),
  );
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

  const count = pos.count;
  const triangles = new Float32Array(count * 3);
  const vertices: GmaVertex[] = [];
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
    triangles[i * 3] = v.x;
    triangles[i * 3 + 1] = v.y;
    triangles[i * 3 + 2] = v.z;
    let u = 0;
    let vv = 0;
    if (uv) {
      u = uv.getX(i);
      vv = uv.getY(i);
    } else {
      // planar map by dominant normal axis so solid textures tile sanely
      const ax = Math.abs(n.x);
      const ay = Math.abs(n.y);
      const az = Math.abs(n.z);
      if (ay >= ax && ay >= az) {
        u = v.x * 0.25;
        vv = v.z * 0.25;
      } else if (ax >= az) {
        u = v.z * 0.25;
        vv = v.y * 0.25;
      } else {
        u = v.x * 0.25;
        vv = v.y * 0.25;
      }
    }
    vertices.push({ px: v.x, py: v.y, pz: v.z, nx: n.x, ny: n.y, nz: n.z, u, v: vv });
  }

  // negative determinant (mirroring scale) flips winding; fix so collision
  // normals and culling stay correct
  if (matrix.determinant() < 0) {
    for (let t = 0; t < count; t += 3) {
      swapTriangleVerts(triangles, vertices, t + 1, t + 2);
    }
  }

  return { triangles, vertices };
}

function swapTriangleVerts(triangles: Float32Array, vertices: GmaVertex[], a: number, b: number): void {
  for (let k = 0; k < 3; k++) {
    const tmp = triangles[a * 3 + k];
    triangles[a * 3 + k] = triangles[b * 3 + k];
    triangles[b * 3 + k] = tmp;
  }
  const tv = vertices[a];
  vertices[a] = vertices[b];
  vertices[b] = tv;
}
