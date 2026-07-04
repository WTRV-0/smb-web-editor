/**
 * Neutral stage document schema. The editor mutates this; the exporter turns it
 * into stagedef (.lz) + GMA + TPL. Keep this JSON-serializable — it is what gets
 * persisted to IndexedDB and .smbproj files.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Transform {
  position: Vec3;
  /** Euler XYZ, degrees (matches how SMB stagedef stores rotations as 16-bit angle units) */
  rotation: Vec3;
  scale: Vec3;
}

export type PrimitiveKind =
  | 'box'
  | 'ramp'
  | 'cylinder'
  | 'wedge'
  | 'cone'
  | 'torus'
  | 'arcRamp'
  | 'stairs'
  | 'tube'
  | 'funnel';

/**
 * Parametric shape definitions. Dimensions in stage units (1 unit = 1 SMB
 * unit; the ball radius is 0.5). box/ramp/cylinder/wedge keep their original
 * field names so documents saved before the union existed still load.
 */
export type PrimitiveParams =
  | { kind: 'box' | 'ramp' | 'wedge'; width: number; height: number; depth: number; segments?: number }
  | { kind: 'cylinder'; width: number; height: number; depth: number; segments?: number }
  | { kind: 'cone'; radius: number; height: number; segments: number }
  | { kind: 'torus'; majorRadius: number; minorRadius: number; segmentsU: number; segmentsV: number }
  | {
      kind: 'arcRamp';
      /** radius of the inner edge */
      innerRadius: number;
      /** radial width of the track */
      width: number;
      /** sweep angle, degrees */
      sweep: number;
      /** slab thickness */
      thickness: number;
      /** bank (superelevation) angle in degrees; positive raises the outer edge */
      bank: number;
      segments: number;
    }
  | { kind: 'stairs'; width: number; rise: number; run: number; steps: number }
  | {
      kind: 'tube';
      radius: number;
      thickness: number;
      /** sweep angle, degrees; 360 = full tube, 180 = half-pipe */
      sweep: number;
      length: number;
      segments: number;
    }
  | { kind: 'funnel'; topRadius: number; bottomRadius: number; height: number; thickness: number; segments: number };

export interface ImportedGeometry {
  /** Flat xyz triples */
  positions: number[];
  normals: number[];
  /** Flat uv pairs (optional) */
  uvs?: number[];
  indices: number[];
}

/**
 * Directly editable polygon mesh (edit mode). Faces are convex polygon loops
 * (triangles/quads/n-gons), wound CCW viewed from outside.
 */
export interface EditableMesh {
  /** Flat xyz triples */
  positions: number[];
  faces: number[][];
}

export interface StageMesh {
  id: string;
  name: string;
  groupId: string;
  transform: Transform;
  color: string; // hex, used as vertex/material color until custom textures (phase 5)
  textureId?: string;
  textureScroll?: { u: number; v: number };
  visible: boolean;
  source:
    | { type: 'primitive'; params: PrimitiveParams }
    | { type: 'imported'; geometry: ImportedGeometry }
    | { type: 'editable'; mesh: EditableMesh };
}

export type GoalVariant = 'blue' | 'green' | 'red';
export type BananaVariant = 'single' | 'bunch';
export type CollisionShapeKind = 'cone' | 'sphere' | 'cylinder';
export type SwitchKind = 'rewind' | 'reverse' | 'stop' | 'play' | 'fastForward';

interface ObjectBase {
  id: string;
  name: string;
  groupId: string;
  position: Vec3;
  rotation: Vec3;
}

export interface GoalObject extends ObjectBase {
  type: 'goal';
  variant: GoalVariant;
}

export interface BananaObject extends ObjectBase {
  type: 'banana';
  variant: BananaVariant;
}

export interface BumperObject extends ObjectBase {
  type: 'bumper';
  scale: Vec3;
}

export interface JamabarObject extends ObjectBase {
  type: 'jamabar';
  scale: Vec3;
}

export interface CollisionShapeObject extends ObjectBase {
  type: 'collisionShape';
  shape: CollisionShapeKind;
  scale: Vec3;
}

export interface WormholeObject extends ObjectBase {
  type: 'wormhole';
  /** id of destination wormhole object */
  destinationId?: string;
}

export interface SwitchObject extends ObjectBase {
  type: 'switch';
  kind: SwitchKind;
  /** item group whose animation this switch controls */
  targetGroupId?: string;
}

export type StageObject =
  | GoalObject
  | BananaObject
  | BumperObject
  | JamabarObject
  | CollisionShapeObject
  | WormholeObject
  | SwitchObject;

export type StageObjectType = StageObject['type'];

export type AnimLoopMode = 'loop' | 'playOnce';

export interface Keyframe {
  /** seconds */
  time: number;
  value: number;
  easing: 'constant' | 'linear' | 'ease';
}

export interface GroupAnimation {
  loopMode: AnimLoopMode;
  /** seconds; stage timer is 60fps in-game */
  duration: number;
  /** channels: per-axis position offsets and rotation, keyed independently like stagedef */
  posX: Keyframe[];
  posY: Keyframe[];
  posZ: Keyframe[];
  rotX: Keyframe[];
  rotY: Keyframe[];
  rotZ: Keyframe[];
}

export interface SeesawSettings {
  sensitivity: number;
  resetStiffness: number;
  rotationBounds: number;
}

export interface ItemGroup {
  id: string;
  name: string;
  /** pivot for animation/seesaw */
  rotationCenter: Vec3;
  animation?: GroupAnimation;
  seesaw?: SeesawSettings;
  /** UV scroll speed applied to this group's models */
  textureScroll?: { u: number; v: number };
}

export interface StageTexture {
  id: string;
  name: string;
  /** PNG/JPEG data URL as uploaded */
  dataUrl: string;
}

export interface StartPlacement {
  position: Vec3;
  rotation: Vec3;
}

export interface StageDocument {
  version: 1;
  id: string;
  name: string;
  /** stage time limit in seconds */
  timeLimit: number;
  falloutY: number;
  /** stock SMB2 background name (e.g. 'jungle'); resolved at export */
  background: string;
  musicId: number;
  start: StartPlacement;
  itemGroups: ItemGroup[];
  meshes: StageMesh[];
  objects: StageObject[];
  /** uploaded texture library for this level */
  textures?: StageTexture[];
  createdAt: number;
  modifiedAt: number;
}

/** A level entry in the library; the document is stored alongside metadata */
export interface LevelRecord {
  id: string;
  setId: string;
  /** order within the set */
  slot: number;
  document: StageDocument;
  /** JPEG data URL captured from the viewport */
  thumbnail?: string;
}

export interface LevelSetRecord {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  modifiedAt: number;
}

export const STATIC_GROUP_ID = 'static';
