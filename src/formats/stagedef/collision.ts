/**
 * Collision triangle encoding and grid sorting for SMB2 stagedefs.
 * Direct port of ws2lz SMB2LzExporter::writeCollisionTriangles ("the madness",
 * originally from Yoshimaster96's smb2cnv) and TriangleIntersectionGrid.
 */

const TAU = Math.PI * 2;

export interface EncodedTriangle {
  // vertex A
  ax: number;
  ay: number;
  az: number;
  // face normal
  nx: number;
  ny: number;
  nz: number;
  // rotation from XZ plane, radians (converted to angle units when written)
  rotX: number;
  rotY: number;
  rotZ: number;
  // deltas of B and C from A in triangle-plane space
  dx2: number;
  dy2: number;
  dx3: number;
  dy3: number;
  // 2D tangent/bitangent
  tx: number;
  ty: number;
  bx: number;
  by: number;
}

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
};

/** Row-vector times column-major 3x3 matrix, matching ws2lz's dotm() */
function dotm(a: V3, m: number[]): V3 {
  return [
    a[0] * m[0] + a[1] * m[3] + a[2] * m[6],
    a[0] * m[1] + a[1] * m[4] + a[2] * m[7],
    a[0] * m[2] + a[1] * m[5] + a[2] * m[8],
  ];
}

const hat = (v: V3): V3 => [-v[1], v[0], 0];

function reverseAngle(c: number, s: number): number {
  let a = Math.asin(s);
  if (c < 0) a = Math.PI - a;
  if (Math.abs(c) < Math.abs(s)) {
    a = Math.acos(c);
    if (s < 0) a = -a;
  }
  if (a < 0) {
    if (a > -0.001) a = 0;
    else a += TAU;
  }
  return a;
}

export function encodeTriangle(a: V3, b: V3, c: V3): EncodedTriangle {
  const normal = norm(cross(norm(sub(b, a)), norm(sub(c, a))));

  let l = Math.sqrt(normal[0] * normal[0] + normal[2] * normal[2]);
  let cy: number;
  let sy: number;
  if (Math.abs(l) < 0.001) {
    cy = 1;
    sy = 0;
  } else {
    cy = normal[2] / l;
    sy = -normal[0] / l;
  }
  const cx = l;
  const sx = normal[1];

  // column-major mat3s as in glm
  const rotXMat = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
  const rotYMat = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];

  let dotry = dotm(sub(b, a), rotYMat);
  let dotrxry = dotm(dotry, rotXMat);
  l = Math.sqrt(dotrxry[0] * dotrxry[0] + dotrxry[1] * dotrxry[1]);

  const cz = dotrxry[0] / l;
  const sz = -dotrxry[1] / l;
  const rotZMat = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];

  const deltaPosB = dotm(dotrxry, rotZMat);
  dotry = dotm(sub(c, a), rotYMat);
  dotrxry = dotm(dotry, rotXMat);
  const deltaPosC = dotm(dotrxry, rotZMat);

  const n0v: V3 = [deltaPosC[0] - deltaPosB[0], deltaPosC[1] - deltaPosB[1], deltaPosC[2] - deltaPosB[2]];
  const n1v: V3 = [-deltaPosC[0], -deltaPosC[1], -deltaPosC[2]];
  const tangent = norm(hat(n0v));
  const bitangent = norm(hat(n1v));

  return {
    ax: a[0],
    ay: a[1],
    az: a[2],
    nx: normal[0],
    ny: normal[1],
    nz: normal[2],
    rotX: TAU - reverseAngle(cx, sx),
    rotY: TAU - reverseAngle(cy, sy),
    rotZ: TAU - reverseAngle(cz, sz),
    dx2: deltaPosB[0],
    dy2: deltaPosB[1],
    dx3: deltaPosC[0],
    dy3: deltaPosC[1],
    tx: tangent[0],
    ty: tangent[1],
    bx: bitangent[0],
    by: bitangent[1],
  };
}

export interface GridConfig {
  startX: number;
  startZ: number;
  stepX: number;
  stepZ: number;
  countX: number;
  countZ: number;
}

/**
 * Sort triangles into collision grid tiles by XZ AABB overlap (0.7 padding).
 * Returns indicesGrid[y][x] = triangle indices touching that tile, matching
 * ws2lz TriangleIntersectionGrid::sortIntersections.
 */
export function sortTrianglesIntoGrid(triangles: Float32Array, grid: GridConfig): number[][][] {
  const indicesGrid: number[][][] = [];
  for (let y = 0; y < grid.countZ; y++) {
    indicesGrid.push([]);
    for (let x = 0; x < grid.countX; x++) indicesGrid[y].push([]);
  }

  const triCount = triangles.length / 9;
  // Precompute triangle XZ AABBs
  const minX = new Float32Array(triCount);
  const maxX = new Float32Array(triCount);
  const minZ = new Float32Array(triCount);
  const maxZ = new Float32Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    minX[t] = Math.min(triangles[o], triangles[o + 3], triangles[o + 6]);
    maxX[t] = Math.max(triangles[o], triangles[o + 3], triangles[o + 6]);
    minZ[t] = Math.min(triangles[o + 2], triangles[o + 5], triangles[o + 8]);
    maxZ[t] = Math.max(triangles[o + 2], triangles[o + 5], triangles[o + 8]);
  }

  const PADDING = 0.7;
  for (let xi = 0; xi < grid.countX; xi++) {
    for (let yi = 0; yi < grid.countZ; yi++) {
      const tileMinX = grid.startX + grid.stepX * xi - PADDING;
      const tileMinZ = grid.startZ + grid.stepZ * yi - PADDING;
      const tileMaxX = tileMinX + grid.stepX + PADDING;
      const tileMaxZ = tileMinZ + grid.stepZ + PADDING;
      for (let t = 0; t < triCount; t++) {
        if (maxX[t] < tileMinX || minX[t] > tileMaxX) continue;
        if (maxZ[t] < tileMinZ || minZ[t] > tileMaxZ) continue;
        indicesGrid[yi][xi].push(t);
      }
    }
  }
  return indicesGrid;
}
