import * as THREE from 'three';
import type { EditableMesh, StageMesh } from '../model/types';
import { primitiveToEditable, triangulate } from './editableMesh';

/**
 * Build renderable geometry for a stage mesh. Same geometry feeds the
 * collision-triangle extraction and GMA export, so keep it watertight.
 *
 * Primitives and editable meshes triangulate through the polygon-mesh core
 * with flat shading and planar per-face UVs. `geometry.userData.faceMap`
 * maps each triangle index to its source polygon face (used by edit mode).
 */
export function buildGeometry(mesh: StageMesh): THREE.BufferGeometry {
  if (mesh.source.type === 'imported') {
    const g = new THREE.BufferGeometry();
    const { positions, normals, uvs, indices } = mesh.source.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    if (uvs?.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    if (!normals.length) g.computeVertexNormals();
    return g;
  }

  const editable = mesh.source.type === 'editable' ? mesh.source.mesh : primitiveToEditable(mesh.source.params);
  return editableToGeometry(editable);
}

export function editableToGeometry(editable: EditableMesh): THREE.BufferGeometry {
  const { positions, faceMap } = triangulate(editable);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(planarUvs(positions), 2));
  g.computeVertexNormals(); // non-indexed -> flat face normals
  g.userData.faceMap = faceMap;
  return g;
}

/** Planar UVs by dominant face-normal axis, so solid/tiled textures map sanely. */
function planarUvs(positions: Float32Array): Float32Array {
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let t = 0; t < positions.length; t += 9) {
    // face normal from the triangle
    const ux = positions[t + 3] - positions[t];
    const uy = positions[t + 4] - positions[t + 1];
    const uz = positions[t + 5] - positions[t + 2];
    const vx = positions[t + 6] - positions[t];
    const vy = positions[t + 7] - positions[t + 1];
    const vz = positions[t + 8] - positions[t + 2];
    const nx = Math.abs(uy * vz - uz * vy);
    const ny = Math.abs(uz * vx - ux * vz);
    const nz = Math.abs(ux * vy - uy * vx);
    for (let k = 0; k < 3; k++) {
      const p = t + k * 3;
      const q = ((t / 9) * 3 + k) * 2;
      const scale = 0.25;
      if (ny >= nx && ny >= nz) {
        uvs[q] = positions[p] * scale;
        uvs[q + 1] = positions[p + 2] * scale;
      } else if (nx >= nz) {
        uvs[q] = positions[p + 2] * scale;
        uvs[q + 1] = positions[p + 1] * scale;
      } else {
        uvs[q] = positions[p] * scale;
        uvs[q + 1] = positions[p + 1] * scale;
      }
    }
  }
  return uvs;
}
