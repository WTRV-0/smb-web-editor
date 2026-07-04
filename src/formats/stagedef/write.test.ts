import { describe, expect, it } from 'vitest';
import { writeStageDef } from './write';
import type { SdGroup, StageDefInput } from './types';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });

function emptyGroup(overrides: Partial<SdGroup> = {}): SdGroup {
  return {
    rotationCenter: v(),
    initialRotation: v(),
    animGroupId: 0,
    triangles: new Float32Array(0),
    modelNames: [],
    goals: [],
    bumpers: [],
    jamabars: [],
    bananas: [],
    cones: [],
    spheres: [],
    cylinders: [],
    switches: [],
    wormholes: [],
    ...overrides,
  };
}

function simpleStage(): StageDefInput {
  // one floor quad (two triangles), one goal, one banana
  const triangles = new Float32Array([
    -4, 0, -4, 4, 0, -4, 4, 0, 4,
    -4, 0, -4, 4, 0, 4, -4, 0, 4,
  ]);
  return {
    falloutY: -10,
    start: { position: v(0, 1, 8), rotation: v() },
    groups: [
      emptyGroup({
        triangles,
        modelNames: ['ST001_MODEL0'],
        goals: [{ position: v(0, 0, -8), rotation: v(), type: 0 }],
        bananas: [{ position: v(1, 0.5, 0), type: 0 }],
      }),
    ],
    backgrounds: [],
  };
}

const u32 = (buf: Uint8Array, off: number) => new DataView(buf.buffer).getUint32(off, false);
const f32 = (buf: Uint8Array, off: number) => new DataView(buf.buffer).getFloat32(off, false);

describe('stagedef writer', () => {
  it('writes a consistent simple stage (internal offset assertions pass)', () => {
    const data = writeStageDef(simpleStage());
    expect(data.length).toBeGreaterThan(2204 + 20 + 4 + 1180);
    // magic
    expect(u32(data, 4)).toBe(0x447a0000);
    // collision header count / offset
    expect(u32(data, 8)).toBe(1);
    expect(u32(data, 12)).toBe(2204 + 20 + 4);
    // start offset points at our start position
    const startOffset = u32(data, 16);
    expect(startOffset).toBe(2204);
    expect(f32(data, startOffset)).toBe(0);
    expect(f32(data, startOffset + 4)).toBe(1);
    expect(f32(data, startOffset + 8)).toBe(8);
    // fallout
    const falloutOffset = u32(data, 20);
    expect(f32(data, falloutOffset)).toBe(-10);
    // goal count 1, goal position readable at goal offset
    expect(u32(data, 0x18)).toBe(1);
    const goalOffset = u32(data, 0x1c);
    expect(f32(data, goalOffset)).toBe(0);
    expect(f32(data, goalOffset + 8)).toBe(-8);
    // banana count 1 and type single
    expect(u32(data, 0x30)).toBe(1);
    const bananaOffset = u32(data, 0x34);
    expect(u32(data, bananaOffset + 12)).toBe(0);
    // stage type flag
    expect(u32(data, 0x6c)).toBe(0x1);
    // level model count is 1 in both slots
    expect(u32(data, 0x8c)).toBe(1);
    expect(u32(data, 0x94)).toBe(1);
    // model name is written NUL-terminated at the name offset referenced by the model entry
    const ptrA = u32(data, 0x90);
    const modelEntryOffset = u32(data, ptrA + 8);
    const nameOffset = u32(data, modelEntryOffset + 4);
    const name = new TextDecoder().decode(data.subarray(nameOffset, nameOffset + 12));
    expect(name).toBe('ST001_MODEL0');
    expect(data[nameOffset + 12]).toBe(0);
  });

  it('links wormholes by file offset', () => {
    const input = simpleStage();
    input.groups[0].wormholes = [
      { position: v(2, 1, 0), rotation: v(), destinationIndex: 1 },
      { position: v(-2, 1, 0), rotation: v(), destinationIndex: 0 },
    ];
    const data = writeStageDef(input);
    const wormholeCount = u32(data, 0xb4);
    expect(wormholeCount).toBe(2);
    const wormholeOffset = u32(data, 0xb8);
    // first wormhole's destination pointer = offset of second wormhole and vice versa
    expect(u32(data, wormholeOffset + 24)).toBe(wormholeOffset + 28);
    expect(u32(data, wormholeOffset + 28 + 24)).toBe(wormholeOffset);
    // wormholes start with the constant 1
    expect(u32(data, wormholeOffset)).toBe(1);
  });

  it('writes animation headers and keyframes for animated groups', () => {
    const input = simpleStage();
    input.groups.push(
      emptyGroup({
        animGroupId: 1,
        rotationCenter: v(0, 0, 0),
        triangles: new Float32Array([0, 2, 0, 2, 2, 0, 2, 2, 2]),
        modelNames: ['ST001_MODEL1'],
        animation: {
          loopType: 0,
          loopTime: 4,
          initialState: 0,
          channels: {
            rotX: [],
            rotY: [
              { time: 0, value: 0, easing: 1 },
              { time: 4, value: 360, easing: 1 },
            ],
            rotZ: [],
            posX: [],
            posY: [],
            posZ: [],
          },
        },
      }),
    );
    const data = writeStageDef(input);
    expect(u32(data, 8)).toBe(2); // two collision headers
    const header2 = u32(data, 12) + 1180;
    // anim seesaw type: 0 (loop), anim header offset non-zero
    const animHeaderOffset = u32(data, header2 + 20);
    expect(animHeaderOffset).toBeGreaterThan(0);
    // rotY count = 2 at anim header +8, offset at +12
    expect(u32(data, animHeaderOffset + 8)).toBe(2);
    const rotYOffset = u32(data, animHeaderOffset + 12);
    // keyframe: easing u32, time f32, value f32
    expect(u32(data, rotYOffset)).toBe(1);
    expect(f32(data, rotYOffset + 4)).toBe(0);
    expect(f32(data, rotYOffset + 8)).toBe(0);
    expect(u32(data, rotYOffset + 20)).toBe(1);
    expect(f32(data, rotYOffset + 24)).toBe(4);
    expect(f32(data, rotYOffset + 28)).toBe(360);
    // loop time in collision header (+212 within header)
    expect(f32(data, header2 + 212)).toBe(4);
  });

  it('encodes seesaw groups with type 2 and parameters', () => {
    const input = simpleStage();
    input.groups[0].seesaw = { sensitivity: 0.5, friction: 8, spring: 0.8 };
    const data = writeStageDef(input);
    const header = u32(data, 12);
    const view = new DataView(data.buffer);
    expect(view.getUint16(header + 18, false)).toBe(2);
    expect(f32(data, header + 184)).toBeCloseTo(0.5);
    expect(f32(data, header + 188)).toBeCloseTo(8);
    expect(f32(data, header + 192)).toBeCloseTo(0.8);
  });

  it('collision grid tile pointers reference terminated index lists', () => {
    const data = writeStageDef(simpleStage());
    const header = u32(data, 12);
    const triListOffset = u32(data, header + 36);
    const tilePtrOffset = u32(data, header + 40);
    expect(triListOffset).toBe(header + 1180);
    // 16x16 grid pointers; floor quad spans tiles near the center
    let nonZero = 0;
    let firstList = 0;
    for (let i = 0; i < 256; i++) {
      const p = u32(data, tilePtrOffset + i * 4);
      if (p !== 0) {
        if (!firstList) firstList = p;
        nonZero++;
      }
    }
    expect(nonZero).toBeGreaterThan(0);
    const view = new DataView(data.buffer);
    // first non-empty tile list contains triangle indices then 0xFFFF
    const i0 = view.getUint16(firstList, false);
    expect(i0).toBeLessThan(2);
    let cursor = firstList;
    while (view.getUint16(cursor, false) !== 0xffff) cursor += 2;
    expect(cursor - firstList).toBeLessThanOrEqual(4);
  });
});
