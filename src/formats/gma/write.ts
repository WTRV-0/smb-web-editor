/**
 * SMB2 .gma model container writer (subset).
 * Port of GxUtils LibGxFormat Gma/Gcmf save paths for the simple case the
 * editor produces: non-indexed float vertex data (SectionFlags = 0), one
 * material per mesh, opaque layer-1 meshes, no transform matrices.
 *
 * Every triangle is emitted as a 3-vertex triangle strip in the CCW group.
 * Vertices carry position + normal + primary UV (vertex flags 0x2600).
 */

import { BinaryWriter } from '../util/BinaryWriter';

export interface GmaVertex {
  px: number;
  py: number;
  pz: number;
  nx: number;
  ny: number;
  nz: number;
  u: number;
  v: number;
}

export interface GmaMeshInput {
  /** index into the shared material list of the model */
  materialIndex: number;
  /** non-indexed triangle list; length multiple of 3 */
  vertices: GmaVertex[];
  twoSided?: boolean;
}

export interface GmaMaterialInput {
  /** index into the companion TPL */
  textureIndex: number;
}

export interface GmaModelInput {
  name: string;
  materials: GmaMaterialInput[];
  meshes: GmaMeshInput[];
}

const VERTEX_FLAGS = 0x200 | 0x400 | 0x2000; // coordinates | normals | primary UV
const VERTEX_SIZE = (3 + 3 + 2) * 4;
const GCMF_MAGIC = 0x47434d46; // 'GCMF'
const MATERIAL_FLAGS = 0x7d4; // GxUtils default: repeat S/T, mipmap+near filtering

export function writeGma(models: GmaModelInput[]): Uint8Array {
  const entriesSize = 8 + 8 * models.length;
  const namesSize = models.reduce((a, m) => a + m.name.length + 1, 0) + 1; // +1 GxUtils quirk
  const headerSize = align32(entriesSize + namesSize);

  const modelSizes = models.map(sizeOfGcmf);
  const total = headerSize + modelSizes.reduce((a, b) => a + b, 0);
  const w = new BinaryWriter(total);

  // container header
  w.u32(models.length);
  w.u32(headerSize);
  let nameOffset = 0;
  let modelOffset = 0;
  for (let i = 0; i < models.length; i++) {
    w.u32(modelOffset);
    w.u32(nameOffset);
    nameOffset += models[i].name.length + 1;
    modelOffset += modelSizes[i];
  }
  const ascii = new TextEncoder();
  for (const m of models) {
    w.raw(ascii.encode(m.name));
    w.u8(0);
  }
  w.u8(0); // file weirdness byte, see GxUtils Gma.Save
  while (w.offset < headerSize) w.u8(0);

  for (const m of models) {
    const start = w.offset;
    writeGcmf(w, m);
    const expected = sizeOfGcmf(m);
    if (w.offset - start > expected) {
      throw new Error(`GCMF size drift for ${m.name}: wrote ${w.offset - start}, expected ${expected}`);
    }
    w.zeros(expected - (w.offset - start)); // model padding to 0x20
  }
  return w.toUint8Array();
}

function boundingSphere(meshes: GmaMeshInput[]): { x: number; y: number; z: number; r: number } {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let any = false;
  for (const mesh of meshes) {
    for (const v of mesh.vertices) {
      any = true;
      minX = Math.min(minX, v.px);
      minY = Math.min(minY, v.py);
      minZ = Math.min(minZ, v.pz);
      maxX = Math.max(maxX, v.px);
      maxY = Math.max(maxY, v.py);
      maxZ = Math.max(maxZ, v.pz);
    }
  }
  if (!any) return { x: 0, y: 0, z: 0, r: 0 };
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  let r2 = 0;
  for (const mesh of meshes) {
    for (const v of mesh.vertices) {
      const d = (v.px - cx) ** 2 + (v.py - cy) ** 2 + (v.pz - cz) ** 2;
      r2 = Math.max(r2, d);
    }
  }
  return { x: cx, y: cy, z: cz, r: Math.sqrt(r2) };
}

function sizeOfMeshData(mesh: GmaMeshInput): number {
  // one 3-vertex strip per triangle: (1 type byte + 2 count bytes) + vertices
  const triCount = mesh.vertices.length / 3;
  return triCount * (3 + 3 * VERTEX_SIZE);
}

function sizeOfGcmf(m: GmaModelInput): number {
  const header = align32(0x40 + 0x20 * m.materials.length);
  const meshes = m.meshes.reduce((a, mesh) => a + 0x60 + sizeOfMeshData(mesh), 0);
  // pad each model to 0x20 so every model base stays aligned
  return align32(header + meshes);
}

function writeGcmf(w: BinaryWriter, m: GmaModelInput): void {
  const bs = boundingSphere(m.meshes);
  const headerSize = align32(0x40 + 0x20 * m.materials.length);

  w.u32(GCMF_MAGIC);
  w.u32(0); // section flags: non-indexed 32-bit float model
  w.f32(bs.x);
  w.f32(bs.y);
  w.f32(bs.z);
  w.f32(bs.r);
  w.u16(m.materials.length);
  w.u16(m.meshes.length); // layer 1 (opaque) mesh count
  w.u16(0); // layer 2 count
  w.u8(0); // transform matrix count
  w.u8(0);
  w.u32(headerSize);
  w.u32(0);
  for (let i = 0; i < 8; i++) w.u8(0xff); // default transform matrix indices
  w.zeros(16);

  for (let i = 0; i < m.materials.length; i++) {
    const mat = m.materials[i];
    w.u32(MATERIAL_FLAGS);
    w.u16(mat.textureIndex);
    w.u8(0); // unk6
    w.u8(0); // anisotropy
    w.u32(0);
    w.u16(0x2e00); // unkC
    w.u16(i);
    w.u32(0x00000030); // unk10
    w.zeros(12);
  }
  // 0x40 + n*0x20 is inherently 0x20-aligned; nothing to pad here

  for (const mesh of m.meshes) {
    const mbs = boundingSphere([mesh]);
    w.u32(mesh.twoSided ? 0x02 : 0); // render flags
    w.u32(0xffffffff); // unk4
    w.u32(0x7f7f7fff); // unk8
    w.u32(0); // unkC
    w.u16(0x00ff); // unk10 (opacity)
    w.u8(1); // used material count
    w.u8(0x01); // section flags: CCW strips only
    w.u16(0xff00); // unk14
    w.u16(mesh.materialIndex);
    w.u16(0xffff); // secondary material
    w.u16(0xffff); // tertiary material
    w.u32(VERTEX_FLAGS);
    for (let i = 0; i < 8; i++) w.u8(0xff); // per-mesh matrix indices
    w.u32(sizeOfMeshData(mesh)); // chunk 1 size (CCW strips)
    w.u32(0); // chunk 2 size (CW strips)
    w.f32(mbs.x);
    w.f32(mbs.y);
    w.f32(mbs.z);
    w.f32(0); // unk3C
    w.u32(0x00000014); // unk40
    w.zeros(28);

    // one strip per triangle
    for (let t = 0; t < mesh.vertices.length; t += 3) {
      w.u8(0x98); // non-indexed float strip
      w.u16(3);
      for (let i = 0; i < 3; i++) {
        const vtx = mesh.vertices[t + i];
        w.f32(vtx.px);
        w.f32(vtx.py);
        w.f32(vtx.pz);
        w.f32(vtx.nx);
        w.f32(vtx.ny);
        w.f32(vtx.nz);
        w.f32(vtx.u);
        w.f32(vtx.v);
      }
    }
  }
}

function align32(n: number): number {
  return (n + 0x1f) & ~0x1f;
}
