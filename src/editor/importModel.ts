import * as THREE from 'three';
import { OBJLoader, GLTFLoader } from 'three-stdlib';
import type { ImportedGeometry, StageMesh } from '../model/types';
import { identityTransform, newId } from '../model/defaults';

/**
 * Parse an OBJ/GLB/GLTF file into a single merged ImportedGeometry.
 * World transforms inside the file are baked into the vertices.
 */
export async function importModelFile(file: File): Promise<StageMesh> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let root: THREE.Object3D;
  if (ext === 'obj') {
    root = new OBJLoader().parse(await file.text());
  } else if (ext === 'glb' || ext === 'gltf') {
    const loader = new GLTFLoader();
    const gltf = await loader.parseAsync(await file.arrayBuffer(), '');
    root = gltf.scene;
  } else {
    throw new Error(`Unsupported model format: .${ext} (use .obj, .glb, or .gltf)`);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  root.updateWorldMatrix(true, true);
  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3();

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const m = child as THREE.Mesh;
    let g = m.geometry;
    if (g.index === null) g = g.toNonIndexed();
    const base = positions.length / 3;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    normalMatrix.getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      positions.push(v.x, v.y, v.z);
      if (nor) {
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        normals.push(v.x, v.y, v.z);
      }
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(base + i);
    }
  });

  if (positions.length === 0) throw new Error('No mesh data found in file');

  const geometry: ImportedGeometry = { positions, normals, uvs: uvs.length ? uvs : undefined, indices };
  return {
    id: newId(),
    name: file.name.replace(/\.[^.]+$/, ''),
    groupId: 'static',
    transform: identityTransform(),
    color: '#7c9cd0',
    visible: true,
    source: { type: 'imported', geometry },
  };
}
