/**
 * SMB2 stagedef (uncompressed .lz.raw) writer.
 * Faithful port of ws2lz SMB2LzExporter (smblevelworkshop2) for the subset of
 * features this editor produces: main-game stages, item groups with transform
 * animation/seesaw, all placeable object types, backgrounds, texture scroll.
 * No fog, race/golf data, foregrounds, or reflective models (offsets written 0).
 *
 * See docs/FORMATS.md for the layout reference.
 */

import { BinaryWriter, alignUp4 } from '../util/BinaryWriter';
import { encodeTriangle, sortTrianglesIntoGrid } from './collision';
import { DEFAULT_GRID, type SdGroup, type SdGroupAnimation, type SdKeyframe, type StageDefInput } from './types';

const FILE_HEADER_LENGTH = 2204;
const START_LENGTH = 20;
const FALLOUT_LENGTH = 4;
const COLLISION_HEADER_LENGTH = 1180;
const COLLISION_TRIANGLE_LENGTH = 64;
const LEVEL_MODEL_POINTER_A_LENGTH = 12;
const LEVEL_MODEL_POINTER_B_LENGTH = 4;
const LEVEL_MODEL_LENGTH = 16;
const GOAL_LENGTH = 20;
const BUMPER_LENGTH = 32;
const JAMABAR_LENGTH = 32;
const BANANA_LENGTH = 16;
const CONE_LENGTH = 32;
const SPHERE_LENGTH = 20;
const CYLINDER_LENGTH = 28;
const SWITCH_LENGTH = 24;
const WORMHOLE_LENGTH = 28;
const BACKGROUND_MODEL_LENGTH = 56;
const ANIMATION_HEADER_LENGTH = 64;
const KEYFRAME_LENGTH = 20;
const EFFECT_HEADER_LENGTH = 48;
const TEXTURE_SCROLL_LENGTH = 8;
const STAGE_TYPE_MAIN_GAME = 0x1;
const BG_MESH_TYPE = 0x1f;

interface GroupLayout {
  group: SdGroup;
  collisionHeader: number;
  triangles: number;
  tilePointers: number;
  /** offset per tile (0 for empty tiles), row-major [y][x] flattened */
  tileIndexListOffsets: number[];
  indicesGrid: number[][][];
  goals: number;
  bumpers: number;
  jamabars: number;
  bananas: number;
  cones: number;
  spheres: number;
  cylinders: number;
  switches: number;
  wormholes: number;
  /** offset of each individual wormhole record (for destination links) */
  wormholeIndividual: number[];
  ptrA: number;
  ptrB: number;
  models: number;
  animHeader: number;
  textureScroll: number;
  animKeyframes?: Record<keyof SdGroupAnimation['channels'], number>;
}

interface BgLayout {
  entry: number;
  name: number;
  effectHeader: number;
  textureScroll: number;
}

export function writeStageDef(input: StageDefInput): Uint8Array {
  const layouts: GroupLayout[] = [];
  const bgLayouts: BgLayout[] = [];
  const modelNameOffsets = new Map<string, number>();
  const bgNameOffsets = new Map<string, number>();

  // ---------- Pass 1: compute offsets ----------
  let off = FILE_HEADER_LENGTH;
  const startOffset = off;
  off += START_LENGTH;
  const falloutOffset = off;
  off += FALLOUT_LENGTH;

  for (const group of input.groups) {
    layouts.push({
      group,
      collisionHeader: off,
      triangles: 0,
      tilePointers: 0,
      tileIndexListOffsets: [],
      indicesGrid: [],
      goals: 0,
      bumpers: 0,
      jamabars: 0,
      bananas: 0,
      cones: 0,
      spheres: 0,
      cylinders: 0,
      switches: 0,
      wormholes: 0,
      wormholeIndividual: [],
      ptrA: 0,
      ptrB: 0,
      models: 0,
      animHeader: 0,
      textureScroll: 0,
    });
    off += COLLISION_HEADER_LENGTH;
  }

  for (const l of layouts) {
    l.triangles = off;
    off += COLLISION_TRIANGLE_LENGTH * (l.group.triangles.length / 9);
  }

  for (const l of layouts) {
    const grid = l.group.grid ?? DEFAULT_GRID;
    l.tilePointers = off;
    off += 4 * grid.countX * grid.countZ;
  }

  for (const l of layouts) {
    const grid = l.group.grid ?? DEFAULT_GRID;
    l.indicesGrid = sortTrianglesIntoGrid(l.group.triangles, grid);
    for (let y = 0; y < grid.countZ; y++) {
      for (let x = 0; x < grid.countX; x++) {
        const tile = l.indicesGrid[y][x];
        if (tile.length === 0) {
          l.tileIndexListOffsets.push(0);
        } else {
          l.tileIndexListOffsets.push(off);
          off += 2 * (tile.length + 1); // indices + 0xFFFF terminator
        }
      }
    }
    off = alignUp4(off);
  }

  const objectSection = (
    field: 'goals' | 'bumpers' | 'jamabars' | 'bananas' | 'cones' | 'spheres' | 'cylinders' | 'switches',
    length: number,
  ) => {
    for (const l of layouts) {
      l[field] = off;
      off += length * l.group[field].length;
    }
  };
  objectSection('goals', GOAL_LENGTH);
  objectSection('bumpers', BUMPER_LENGTH);
  objectSection('jamabars', JAMABAR_LENGTH);
  objectSection('bananas', BANANA_LENGTH);
  objectSection('cones', CONE_LENGTH);
  objectSection('spheres', SPHERE_LENGTH);
  objectSection('cylinders', CYLINDER_LENGTH);
  objectSection('switches', SWITCH_LENGTH);

  const wormholeOffsets: number[] = []; // global write-order offsets
  for (const l of layouts) {
    l.wormholes = off;
    for (let i = 0; i < l.group.wormholes.length; i++) {
      l.wormholeIndividual.push(off);
      wormholeOffsets.push(off);
      off += WORMHOLE_LENGTH;
    }
  }

  for (const l of layouts) {
    l.ptrA = off;
    off += LEVEL_MODEL_POINTER_A_LENGTH * l.group.modelNames.length;
  }
  for (const l of layouts) {
    l.ptrB = off;
    off += LEVEL_MODEL_POINTER_B_LENGTH * l.group.modelNames.length;
  }
  for (const l of layouts) {
    l.models = off;
    off += LEVEL_MODEL_LENGTH * l.group.modelNames.length;
  }
  for (const l of layouts) {
    for (const name of l.group.modelNames) {
      modelNameOffsets.set(name, off);
      off += alignUp4(name.length + 1);
    }
  }

  for (let i = 0; i < input.backgrounds.length; i++) {
    bgLayouts.push({ entry: off, name: 0, effectHeader: 0, textureScroll: 0 });
    off += BACKGROUND_MODEL_LENGTH;
  }
  for (let i = 0; i < input.backgrounds.length; i++) {
    bgLayouts[i].name = off;
    bgNameOffsets.set(input.backgrounds[i].name, off);
    off += alignUp4(input.backgrounds[i].name.length + 1);
  }

  // item group animation headers
  for (const l of layouts) {
    if (l.group.animation) {
      l.animHeader = off;
      off += ANIMATION_HEADER_LENGTH;
    }
  }

  // background effect headers
  for (const bgl of bgLayouts) {
    bgl.effectHeader = off;
    off += EFFECT_HEADER_LENGTH;
  }

  // background texture scroll, then item group texture scroll
  for (const bgl of bgLayouts) {
    bgl.textureScroll = off;
    off += TEXTURE_SCROLL_LENGTH;
  }
  for (const l of layouts) {
    l.textureScroll = off;
    off += TEXTURE_SCROLL_LENGTH;
  }

  // item group animation keyframes (rot XYZ then pos XYZ)
  for (const l of layouts) {
    const anim = l.group.animation;
    if (!anim) continue;
    const kf = {} as Record<keyof SdGroupAnimation['channels'], number>;
    for (const ch of ['rotX', 'rotY', 'rotZ', 'posX', 'posY', 'posZ'] as const) {
      kf[ch] = off;
      off += KEYFRAME_LENGTH * anim.channels[ch].length;
    }
    l.animKeyframes = kf;
  }

  // ---------- Pass 2: write ----------
  const w = new BinaryWriter(off + 64);
  const assertAt = (expected: number, what: string) => {
    if (w.offset !== expected) {
      throw new Error(`stagedef writer drift at ${what}: wrote to ${w.offset}, expected ${expected}`);
    }
  };

  const totals = {
    goals: sum(layouts, (l) => l.group.goals.length),
    bumpers: sum(layouts, (l) => l.group.bumpers.length),
    jamabars: sum(layouts, (l) => l.group.jamabars.length),
    bananas: sum(layouts, (l) => l.group.bananas.length),
    cones: sum(layouts, (l) => l.group.cones.length),
    spheres: sum(layouts, (l) => l.group.spheres.length),
    cylinders: sum(layouts, (l) => l.group.cylinders.length),
    switches: sum(layouts, (l) => l.group.switches.length),
    wormholes: sum(layouts, (l) => l.group.wormholes.length),
    models: sum(layouts, (l) => l.group.modelNames.length),
  };

  // --- file header ---
  w.zeros(4);
  w.u32(0x447a0000);
  w.u32(layouts.length);
  w.u32(layouts.length > 0 ? layouts[0].collisionHeader : 0);
  w.u32(startOffset);
  w.u32(falloutOffset);
  w.u32(totals.goals);
  w.u32(totals.goals > 0 ? layouts[0].goals : 0);
  w.u32(totals.bumpers);
  w.u32(totals.bumpers > 0 ? layouts[0].bumpers : 0);
  w.u32(totals.jamabars);
  w.u32(totals.jamabars > 0 ? layouts[0].jamabars : 0);
  w.u32(totals.bananas);
  w.u32(totals.bananas > 0 ? layouts[0].bananas : 0);
  w.u32(totals.cones);
  w.u32(totals.cones > 0 ? layouts[0].cones : 0);
  w.u32(totals.spheres);
  w.u32(totals.spheres > 0 ? layouts[0].spheres : 0);
  w.u32(totals.cylinders);
  w.u32(totals.cylinders > 0 ? layouts[0].cylinders : 0);
  w.u32(0); // fallout volume count
  w.u32(0); // fallout volume offset
  w.u32(bgLayouts.length);
  w.u32(bgLayouts.length > 0 ? bgLayouts[0].entry : 0);
  w.u32(0); // foreground count
  w.u32(0); // foreground offset
  w.u32(0); // monkey race header offset
  w.u32(STAGE_TYPE_MAIN_GAME);
  w.u32(0); // runtime reflective model count
  w.u32(0); // reflective model list offset (must be 0 for wormholes to work)
  w.u32(0); // golf hole offset
  w.zeros(8);
  w.zeros(8); // level model instances
  w.u32(totals.models);
  w.u32(layouts.length > 0 ? layouts[0].ptrA : 0);
  w.u32(totals.models);
  w.u32(layouts.length > 0 ? layouts[0].ptrB : 0);
  w.zeros(12);
  w.u32(totals.switches);
  w.u32(layouts.length > 0 ? layouts[0].switches : 0);
  w.u32(0); // fog animation header offset
  w.u32(totals.wormholes);
  w.u32(layouts.length > 0 ? layouts[0].wormholes : 0);
  w.u32(0); // fog offset
  w.zeros(20);
  w.zeros(4); // mystery 3
  w.zeros(1988);
  assertAt(FILE_HEADER_LENGTH, 'file header');

  // --- start / fallout ---
  w.vec3(input.start.position);
  w.rot3(input.start.rotation);
  w.zeros(2);
  w.f32(input.falloutY);
  assertAt(falloutOffset + FALLOUT_LENGTH, 'fallout');

  // --- collision headers ---
  for (const l of layouts) {
    assertAt(l.collisionHeader, 'collision header');
    const g = l.group;
    const grid = g.grid ?? DEFAULT_GRID;
    const anim = g.animation;
    w.vec3(g.rotationCenter);
    w.rot3(g.initialRotation);
    w.u16(g.seesaw ? 0x0002 : anim && anim.loopType === 1 ? 0x0001 : 0x0000);
    w.u32(anim ? l.animHeader : 0);
    w.vec3({ x: 0, y: 0, z: 0 }); // conveyor speed
    w.u32(l.triangles);
    w.u32(l.tilePointers);
    w.f32(grid.startX);
    w.f32(grid.startZ);
    w.f32(grid.stepX);
    w.f32(grid.stepZ);
    w.u32(grid.countX);
    w.u32(grid.countZ);
    w.u32(g.goals.length);
    w.u32(l.goals);
    w.u32(g.bumpers.length);
    w.u32(l.bumpers);
    w.u32(g.jamabars.length);
    w.u32(l.jamabars);
    w.u32(g.bananas.length);
    w.u32(l.bananas);
    w.u32(g.cones.length);
    w.u32(l.cones);
    w.u32(g.spheres.length);
    w.u32(l.spheres);
    w.u32(g.cylinders.length);
    w.u32(l.cylinders);
    w.u32(0); // fallout volume count
    w.u32(0); // fallout volume offset
    w.u32(0); // reflective model count
    w.u32(0); // reflective model offset
    w.zeros(8);
    w.u32(g.modelNames.length);
    w.u32(l.ptrB);
    w.zeros(8);
    w.u16(g.animGroupId);
    w.zeros(2);
    w.u32(g.switches.length);
    w.u32(l.switches);
    w.zeros(4); // mystery 5 count
    w.zeros(4); // mystery 5 offset
    w.f32(g.seesaw?.sensitivity ?? 0);
    w.f32(g.seesaw?.friction ?? 0);
    w.f32(g.seesaw?.spring ?? 0);
    w.u32(g.wormholes.length);
    w.u32(l.wormholes);
    w.u32(anim ? anim.initialState : 0);
    w.zeros(4);
    w.f32(anim ? anim.loopTime : 0);
    w.u32(l.textureScroll);
    w.zeros(960);
    assertAt(l.collisionHeader + COLLISION_HEADER_LENGTH, 'collision header end');
  }

  // --- collision triangles ---
  for (const l of layouts) {
    assertAt(l.triangles, 'triangles');
    const tris = l.group.triangles;
    const flags = l.group.triangleFlags;
    for (let t = 0; t < tris.length / 9; t++) {
      const o = t * 9;
      const enc = encodeTriangle(
        [tris[o], tris[o + 1], tris[o + 2]],
        [tris[o + 3], tris[o + 4], tris[o + 5]],
        [tris[o + 6], tris[o + 7], tris[o + 8]],
      );
      w.f32(enc.ax);
      w.f32(enc.ay);
      w.f32(enc.az);
      w.f32(enc.nx);
      w.f32(enc.ny);
      w.f32(enc.nz);
      // rotation is in radians here; convert through degrees to angle units
      w.rot3({ x: rad2deg(enc.rotX), y: rad2deg(enc.rotY), z: rad2deg(enc.rotZ) });
      w.u16(flags?.[t] ?? 0);
      w.f32(enc.dx2);
      w.f32(enc.dy2);
      w.f32(enc.dx3);
      w.f32(enc.dy3);
      w.f32(enc.tx);
      w.f32(enc.ty);
      w.f32(enc.bx);
      w.f32(enc.by);
    }
  }

  // --- grid tile pointers ---
  for (const l of layouts) {
    assertAt(l.tilePointers, 'tile pointers');
    for (const tileOffset of l.tileIndexListOffsets) w.u32(tileOffset);
  }

  // --- grid triangle index lists ---
  for (const l of layouts) {
    let bytes = 0;
    for (let y = 0; y < l.indicesGrid.length; y++) {
      for (let x = 0; x < l.indicesGrid[y].length; x++) {
        const tile = l.indicesGrid[y][x];
        if (tile.length === 0) continue;
        for (const idx of tile) w.u16(idx);
        w.u16(0xffff);
        bytes += 2 * (tile.length + 1);
      }
    }
    if (bytes % 4 !== 0) w.zeros(2);
  }

  // --- objects ---
  for (const l of layouts) {
    assertAt(l.goals, 'goals');
    for (const goal of l.group.goals) {
      w.vec3(goal.position);
      w.rot3(goal.rotation);
      w.u8(goal.type);
      w.u8(goal.castShadow ? 1 : 0);
    }
  }
  for (const l of layouts) {
    for (const b of l.group.bumpers) {
      w.vec3(b.position);
      w.rot3(b.rotation);
      w.zeros(2);
      w.vec3(b.scale);
    }
  }
  for (const l of layouts) {
    for (const j of l.group.jamabars) {
      w.vec3(j.position);
      w.rot3(j.rotation);
      w.zeros(2);
      w.vec3(j.scale);
    }
  }
  for (const l of layouts) {
    for (const b of l.group.bananas) {
      w.vec3(b.position);
      w.u32(b.type);
    }
  }
  for (const l of layouts) {
    for (const c of l.group.cones) {
      w.vec3(c.position);
      w.rot3(c.rotation);
      w.zeros(2);
      w.f32(c.radius);
      w.f32(c.height);
      w.f32(c.radius);
    }
  }
  for (const l of layouts) {
    for (const s of l.group.spheres) {
      w.vec3(s.position);
      w.f32(s.radius);
      w.zeros(4);
    }
  }
  for (const l of layouts) {
    for (const c of l.group.cylinders) {
      w.vec3(c.position);
      w.f32(c.radius);
      w.f32(c.height);
      w.rot3(c.rotation);
      w.zeros(2);
    }
  }
  for (const l of layouts) {
    assertAt(l.switches, 'switches');
    for (const s of l.group.switches) {
      w.vec3(s.position);
      w.rot3(s.rotation);
      w.u16(s.playbackState);
      w.u16(s.animGroupId);
      w.zeros(2);
    }
  }
  for (const l of layouts) {
    assertAt(l.wormholes, 'wormholes');
    for (const wh of l.group.wormholes) {
      w.u32(0x00000001);
      w.vec3(wh.position);
      w.rot3(wh.rotation);
      w.zeros(2);
      w.u32(wormholeOffsets[wh.destinationIndex] ?? 0);
    }
  }

  // --- level models ---
  for (const l of layouts) {
    assertAt(l.ptrA, 'ptrA');
    let modelOffset = l.models;
    for (let i = 0; i < l.group.modelNames.length; i++) {
      w.u32(0); // bitflag
      w.u32(0x00000001);
      w.u32(modelOffset);
      modelOffset += LEVEL_MODEL_LENGTH;
    }
  }
  for (const l of layouts) {
    let ptrAOffset = l.ptrA;
    for (let i = 0; i < l.group.modelNames.length; i++) {
      w.u32(ptrAOffset);
      ptrAOffset += LEVEL_MODEL_POINTER_A_LENGTH;
    }
  }
  for (const l of layouts) {
    for (const name of l.group.modelNames) {
      w.zeros(4);
      w.u32(modelNameOffsets.get(name)!);
      w.zeros(8);
    }
  }
  for (const l of layouts) {
    for (const name of l.group.modelNames) {
      w.cstringAligned4(name);
    }
  }

  // --- backgrounds ---
  for (let i = 0; i < input.backgrounds.length; i++) {
    const bg = input.backgrounds[i];
    const bgl = bgLayouts[i];
    assertAt(bgl.entry, 'background');
    w.u32(BG_MESH_TYPE);
    w.u32(bgl.name);
    w.zeros(4);
    w.vec3(bg.position);
    w.rot3(bg.rotation);
    w.zeros(2);
    w.vec3(bg.scale);
    w.zeros(4);
    w.u32(0); // animation header offset
    w.u32(bgl.effectHeader);
  }
  for (let i = 0; i < input.backgrounds.length; i++) {
    w.cstringAligned4(input.backgrounds[i].name);
  }

  // --- item group animation headers ---
  for (const l of layouts) {
    const anim = l.group.animation;
    if (!anim) continue;
    assertAt(l.animHeader, 'anim header');
    for (const ch of ['rotX', 'rotY', 'rotZ', 'posX', 'posY', 'posZ'] as const) {
      w.u32(anim.channels[ch].length);
      w.u32(l.animKeyframes![ch]);
    }
    w.zeros(16);
  }

  // --- background effect headers + texture scroll ---
  for (const bgl of bgLayouts) {
    assertAt(bgl.effectHeader, 'bg effect header');
    w.u32(0);
    w.u32(0);
    w.u32(0);
    w.u32(0);
    w.u32(bgl.textureScroll);
    w.zeros(28);
  }
  for (let i = 0; i < bgLayouts.length; i++) {
    w.f32(0);
    w.f32(0);
  }
  for (const l of layouts) {
    assertAt(l.textureScroll, 'texture scroll');
    w.f32(l.group.textureScroll?.u ?? 0);
    w.f32(l.group.textureScroll?.v ?? 0);
  }

  // --- item group animation keyframes ---
  for (const l of layouts) {
    const anim = l.group.animation;
    if (!anim) continue;
    for (const ch of ['rotX', 'rotY', 'rotZ', 'posX', 'posY', 'posZ'] as const) {
      assertAt(l.animKeyframes![ch], `keyframes ${ch}`);
      for (const k of anim.channels[ch]) writeKeyframe(w, k);
    }
  }

  assertAt(off, 'end of data');
  w.zeros(64);
  return w.toUint8Array();
}

function writeKeyframe(w: BinaryWriter, k: SdKeyframe): void {
  w.u32(k.easing);
  w.f32(k.time);
  w.f32(k.value);
  w.f32(k.handleA ?? 0);
  w.f32(k.handleB ?? 0);
}

function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}

function sum<T>(arr: T[], fn: (t: T) => number): number {
  return arr.reduce((acc, t) => acc + fn(t), 0);
}
