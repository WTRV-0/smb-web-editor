import {
  STATIC_GROUP_ID,
  type ItemGroup,
  type PrimitiveKind,
  type PrimitiveParams,
  type StageDocument,
  type StageMesh,
  type StageObject,
  type StageObjectType,
  type Transform,
  type Vec3,
} from './types';

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const identityTransform = (): Transform => ({
  position: vec3(),
  rotation: vec3(),
  scale: vec3(1, 1, 1),
});

export function newId(): string {
  return crypto.randomUUID();
}

export function staticGroup(): ItemGroup {
  return { id: STATIC_GROUP_ID, name: 'Static', rotationCenter: vec3() };
}

let groupCounter = 0;

export function newItemGroup(): ItemGroup {
  return { id: newId(), name: `Group ${++groupCounter}`, rotationCenter: vec3() };
}

let meshCounter = 0;
let objectCounter = 0;

export function defaultPrimitiveParams(kind: PrimitiveKind): PrimitiveParams {
  switch (kind) {
    case 'box':
      return { kind, width: 4, height: 0.5, depth: 4 };
    case 'ramp':
      return { kind, width: 4, height: 2, depth: 6 };
    case 'wedge':
      return { kind, width: 4, height: 0.5, depth: 4 };
    case 'cylinder':
      return { kind, width: 4, height: 0.5, depth: 4, segments: 24 };
    case 'cone':
      return { kind, radius: 1, height: 2, segments: 20 };
    case 'torus':
      return { kind, majorRadius: 3, minorRadius: 0.5, segmentsU: 24, segmentsV: 12 };
    case 'arcRamp':
      return { kind, innerRadius: 4, width: 3, sweep: 90, thickness: 0.5, bank: 0, segments: 16 };
    case 'stairs':
      return { kind, width: 3, rise: 2, run: 4, steps: 8 };
    case 'tube':
      return { kind, radius: 2, thickness: 0.4, sweep: 180, length: 8, segments: 16 };
    case 'funnel':
      return { kind, topRadius: 4, bottomRadius: 1.2, height: 3, thickness: 0.4, segments: 20 };
  }
}

const KIND_LABELS: Record<PrimitiveKind, string> = {
  box: 'Box',
  ramp: 'Ramp',
  cylinder: 'Cylinder',
  wedge: 'Wedge',
  cone: 'Cone',
  torus: 'Torus',
  arcRamp: 'Arc Ramp',
  stairs: 'Stairs',
  tube: 'Half-pipe',
  funnel: 'Funnel',
};

export function newPrimitiveMesh(kind: PrimitiveKind, groupId = STATIC_GROUP_ID): StageMesh {
  return {
    id: newId(),
    name: `${KIND_LABELS[kind]} ${++meshCounter}`,
    groupId,
    transform: identityTransform(),
    color: '#4a9e57',
    visible: true,
    source: { type: 'primitive', params: defaultPrimitiveParams(kind) },
  };
}

export function newObject(type: StageObjectType, groupId = STATIC_GROUP_ID): StageObject {
  const base = {
    id: newId(),
    groupId,
    position: vec3(0, 1, 0),
    rotation: vec3(),
  };
  const n = ++objectCounter;
  switch (type) {
    case 'goal':
      return { ...base, type, name: `Goal ${n}`, variant: 'blue' };
    case 'banana':
      return { ...base, type, name: `Banana ${n}`, variant: 'single' };
    case 'bumper':
      return { ...base, type, name: `Bumper ${n}`, scale: vec3(1, 1, 1) };
    case 'jamabar':
      return { ...base, type, name: `Jamabar ${n}`, scale: vec3(1, 1, 1) };
    case 'collisionShape':
      return { ...base, type, name: `Collider ${n}`, shape: 'sphere', scale: vec3(1, 1, 1) };
    case 'wormhole':
      return { ...base, type, name: `Wormhole ${n}` };
    case 'switch':
      return { ...base, type, name: `Switch ${n}`, kind: 'play' };
  }
}

export function newStageDocument(name = 'Untitled Stage'): StageDocument {
  const now = Date.now();
  const floor = newPrimitiveMesh('box');
  floor.name = 'Floor';
  const goal = newObject('goal');
  goal.position = vec3(0, 0.5, -8);
  const doc: StageDocument = {
    version: 1,
    id: newId(),
    name,
    timeLimit: 60,
    falloutY: -10,
    background: 'jungle',
    musicId: 36,
    start: { position: vec3(0, 1, 8), rotation: vec3() },
    itemGroups: [staticGroup()],
    meshes: [{ ...floor, transform: { ...identityTransform(), scale: vec3(1, 1, 1), position: vec3(0, -0.25, 0) }, source: { type: 'primitive', params: { kind: 'box', width: 8, height: 0.5, depth: 20 } } }],
    objects: [goal],
    createdAt: now,
    modifiedAt: now,
  };
  return doc;
}
