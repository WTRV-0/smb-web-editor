/**
 * A hand-authored showcase stage seeded into the default set, demonstrating
 * most editor features: textured floors, an arc ramp and stairs, a rotating
 * animated platform driven by a switch, goals, bananas and a bunch, bumpers,
 * and a linked wormhole pair.
 */
import { newId, newObject, vec3 } from './defaults';
import type { PrimitiveParams, StageDocument, StageMesh, StageObject, Vec3 } from './types';

const SPINNER = 'ig-spinner';

function mesh(
  name: string,
  groupId: string,
  params: PrimitiveParams,
  position: Vec3,
  opts: { texture?: string; color?: string; rotation?: Vec3 } = {},
): StageMesh {
  return {
    id: newId(),
    name,
    groupId,
    transform: { position, rotation: opts.rotation ?? vec3(), scale: vec3(1, 1, 1) },
    color: opts.color ?? '#4a9e57',
    textureId: opts.texture,
    visible: true,
    source: { type: 'primitive', params },
  };
}

function obj<T extends StageObject['type']>(type: T, position: Vec3, patch: (o: Extract<StageObject, { type: T }>) => void): StageObject {
  const o = newObject(type) as Extract<StageObject, { type: T }>;
  o.position = position;
  patch(o);
  return o as StageObject;
}

export function buildExampleStage(): StageDocument {
  const now = Date.now();
  const grass = 'builtin:grass';
  const stone = 'builtin:stone';
  const wood = 'builtin:wood';

  const meshes: StageMesh[] = [
    // start platform
    mesh('Start Pad', 'static', { kind: 'box', width: 7, height: 0.5, depth: 7 }, vec3(0, -0.25, 12), { texture: grass }),
    // bridge toward the middle
    mesh('Bridge', 'static', { kind: 'box', width: 3.5, height: 0.5, depth: 8 }, vec3(0, -0.25, 5.5), { texture: grass }),
    // rotating platform (animated group)
    mesh('Spinner', SPINNER, { kind: 'box', width: 8, height: 0.5, depth: 8 }, vec3(0, -0.25, -1), { texture: stone }),
    mesh('Spinner Arm', SPINNER, { kind: 'box', width: 1.5, height: 0.6, depth: 10 }, vec3(0, 0.1, -1), { texture: wood }),
    // banked arc ramp curving off to the side toward the stairs
    mesh(
      'Curve',
      'static',
      { kind: 'arcRamp', innerRadius: 5, width: 3.5, sweep: 90, thickness: 0.5, bank: 18, segments: 20 },
      vec3(-1, 0, -8),
      { texture: grass, rotation: vec3(0, -90, 0) },
    ),
    // stairs up to the goal deck
    mesh('Stairs', 'static', { kind: 'stairs', width: 4, rise: 3, run: 6, steps: 10 }, vec3(-9, 0, -13), {
      texture: stone,
      rotation: vec3(0, 90, 0),
    }),
    // elevated goal deck
    mesh('Goal Deck', 'static', { kind: 'box', width: 8, height: 0.5, depth: 6 }, vec3(-9, 3, -18), { texture: grass }),
  ];

  const wormholeA = obj('wormhole', vec3(3, 1, 11), () => {});
  const wormholeB = obj('wormhole', vec3(-9, 4, -18), () => {});
  (wormholeA as Extract<StageObject, { type: 'wormhole' }>).destinationId = wormholeB.id;
  (wormholeB as Extract<StageObject, { type: 'wormhole' }>).destinationId = wormholeA.id;

  const objects: StageObject[] = [
    // goals
    obj('goal', vec3(-9, 3.25, -20), (o) => (o.variant = 'blue')),
    obj('goal', vec3(-11, 3.25, -20), (o) => (o.variant = 'green')),
    // bananas along the path
    obj('banana', vec3(0, 0.6, 9), () => {}),
    obj('banana', vec3(0, 0.6, 6), () => {}),
    obj('banana', vec3(0, 0.6, 3), () => {}),
    obj('banana', vec3(-4, 0.6, -8), () => {}),
    obj('banana', vec3(-6, 1.6, -11), () => {}),
    // a bunch reward on the spinner
    obj('banana', vec3(0, 0.8, -1), (o) => (o.variant = 'bunch')),
    // bumpers guarding the bridge
    obj('bumper', vec3(1.4, 0.3, 5.5), () => {}),
    obj('bumper', vec3(-1.4, 0.3, 5.5), () => {}),
    // a switch that starts/controls the spinner
    obj('switch', vec3(2.4, 0.35, 12), (o) => {
      o.kind = 'play';
      o.targetGroupId = SPINNER;
    }),
    wormholeA,
    wormholeB,
  ];

  return {
    version: 1,
    id: newId(),
    name: 'Example — Spinner Course',
    timeLimit: 60,
    falloutY: -10,
    background: 'jungle',
    musicId: 36,
    start: { position: vec3(0, 1, 15), rotation: vec3() },
    itemGroups: [
      { id: 'static', name: 'Static', rotationCenter: vec3() },
      {
        id: SPINNER,
        name: 'Spinner',
        rotationCenter: vec3(0, 0, -1),
        animation: {
          loopMode: 'loop',
          duration: 8,
          posX: [],
          posY: [],
          posZ: [],
          rotX: [],
          rotY: [
            { time: 0, value: 0, easing: 'linear' },
            { time: 8, value: 360, easing: 'linear' },
          ],
          rotZ: [],
        },
      },
    ],
    meshes,
    objects,
    textures: [],
    createdAt: now,
    modifiedAt: now,
  };
}
