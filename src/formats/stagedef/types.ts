/**
 * Input model for the SMB2 stagedef writer. Deliberately decoupled from the
 * editor's StageDocument: positions/rotations here are already in stage space,
 * mesh transforms baked into triangles, rotations in degrees.
 */

export interface SdVec3 {
  x: number;
  y: number;
  z: number;
}

export interface SdKeyframe {
  /** seconds */
  time: number;
  value: number;
  /** 0 constant, 1 linear, 2 cubic */
  easing: number;
  handleA?: number;
  handleB?: number;
}

export interface SdAnimChannels {
  rotX: SdKeyframe[];
  rotY: SdKeyframe[];
  rotZ: SdKeyframe[];
  posX: SdKeyframe[];
  posY: SdKeyframe[];
  posZ: SdKeyframe[];
}

export interface SdGroupAnimation {
  /** 0 = loop, 1 = play once */
  loopType: 0 | 1;
  /** seconds */
  loopTime: number;
  /** EnumPlaybackState: 0 play, 1 pause, 2 backwards, 3 ff, 4 rewind */
  initialState: number;
  channels: SdAnimChannels;
}

export interface SdSeesaw {
  sensitivity: number;
  friction: number;
  spring: number;
}

export interface SdGoal {
  position: SdVec3;
  rotation: SdVec3;
  /** 0 blue, 1 green, 2 red */
  type: number;
  castShadow?: boolean;
}

export interface SdBumper {
  position: SdVec3;
  rotation: SdVec3;
  scale: SdVec3;
}

export interface SdBanana {
  position: SdVec3;
  /** 0 single, 1 bunch */
  type: number;
}

export interface SdCone {
  position: SdVec3;
  rotation: SdVec3;
  radius: number;
  height: number;
}

export interface SdSphere {
  position: SdVec3;
  radius: number;
}

export interface SdCylinder {
  position: SdVec3;
  rotation: SdVec3;
  radius: number;
  height: number;
}

export interface SdSwitch {
  position: SdVec3;
  rotation: SdVec3;
  /** EnumPlaybackState the switch sets */
  playbackState: number;
  /** anim group id the switch controls */
  animGroupId: number;
}

export interface SdWormhole {
  position: SdVec3;
  rotation: SdVec3;
  /** global wormhole index (across all groups, in write order) of the destination */
  destinationIndex: number;
}

export interface SdGroup {
  rotationCenter: SdVec3;
  initialRotation: SdVec3;
  /** referenced by switches; static group is 0 */
  animGroupId: number;
  animation?: SdGroupAnimation;
  seesaw?: SdSeesaw;
  /** Baked triangle soup in group-local space: 9 floats per triangle */
  triangles: Float32Array;
  /** per-triangle collision flag (u16); defaults to 0 */
  triangleFlags?: Uint16Array;
  /** GMA model names rendered with this group */
  modelNames: string[];
  goals: SdGoal[];
  bumpers: SdBumper[];
  jamabars: SdBumper[];
  bananas: SdBanana[];
  cones: SdCone[];
  spheres: SdSphere[];
  cylinders: SdCylinder[];
  switches: SdSwitch[];
  wormholes: SdWormhole[];
  textureScroll?: { u: number; v: number };
  /** collision grid; defaults to start -256,-256 step 32 count 16x16 */
  grid?: { startX: number; startZ: number; stepX: number; stepZ: number; countX: number; countZ: number };
}

export interface SdBackground {
  name: string;
  position: SdVec3;
  rotation: SdVec3;
  scale: SdVec3;
}

export interface StageDefInput {
  falloutY: number;
  start: { position: SdVec3; rotation: SdVec3 };
  groups: SdGroup[];
  backgrounds: SdBackground[];
}

export const DEFAULT_GRID = { startX: -256, startZ: -256, stepX: 32, stepZ: 32, countX: 16, countZ: 16 };
