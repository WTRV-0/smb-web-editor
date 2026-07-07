import type { StageDocument, StageObject, SwitchKind } from '../model/types';
import type { SdGroup, StageDefInput } from '../formats/stagedef/types';
import type { GmaModelInput } from '../formats/gma/write';
import type { TplTextureInput } from '../formats/tpl/write';
import { bakeMesh } from './bakeGeometry';
import { getBuiltinTexture, isBuiltinTexture } from '../textures/builtin';

const GOAL_TYPE = { blue: 0, green: 1, red: 2 } as const;
const BANANA_TYPE = { single: 0, bunch: 1 } as const;
const SWITCH_STATE: Record<SwitchKind, number> = {
  play: 0,
  stop: 1,
  reverse: 2,
  fastForward: 3,
  rewind: 4,
};
const EASING = { constant: 0, linear: 1, ease: 2 } as const;

export interface ExportBundle {
  stageDef: StageDefInput;
  gmaModels: GmaModelInput[];
  tplTextures: TplTextureInput[];
}

/**
 * Convert the editor document into inputs for the three binary writers.
 * `decodedTextures` maps StageTexture ids to RGBA data (see decodeTextures);
 * meshes referencing missing/undecoded textures fall back to their color.
 */
/** Raw texture blocks pulled from the user's ISO, keyed by document texture id. */
export type GameTextureResolver = Map<
  string,
  { raw: Uint8Array; format: number; width: number; height: number; levelCount: number }
>;

export function buildExport(
  doc: StageDocument,
  decodedTextures: Map<string, TplTextureInput> = new Map(),
  resolvedGame: GameTextureResolver = new Map(),
): ExportBundle {
  const tplTextures: TplTextureInput[] = [];
  const colorTextureIndex = new Map<string, number>();
  const idTextureIndex = new Map<string, number>();
  const byId = new Map((doc.textures ?? []).map((t) => [t.id, t]));
  const textureForColor = (hex: string): number => {
    const existing = colorTextureIndex.get(hex);
    if (existing !== undefined) return existing;
    const idx = tplTextures.length;
    tplTextures.push(solidTexture(hex));
    colorTextureIndex.set(hex, idx);
    return idx;
  };
  const push = (id: string, tex: TplTextureInput): number => {
    const existing = idTextureIndex.get(id);
    if (existing !== undefined) return existing;
    const idx = tplTextures.length;
    tplTextures.push(tex);
    idTextureIndex.set(id, idx);
    return idx;
  };
  const textureForMesh = (mesh: { textureId?: string; color: string }): number => {
    const id = mesh.textureId;
    // built-in procedural textures (grass checker etc.) — baked into the .tpl
    if (isBuiltinTexture(id)) {
      const t = getBuiltinTexture(id);
      return push(id, { rgba: t.rgba, width: t.width, height: t.height });
    }
    if (id) {
      const ref = byId.get(id);
      // game texture reference: copy the raw block from the ISO if we have it
      if (ref?.kind === 'game') {
        const resolved = resolvedGame.get(id);
        if (resolved) return push(id, resolved);
        // no ISO available (e.g. zip export): fall back to the grass checker
        const g = getBuiltinTexture('builtin:grass');
        return push(id, { rgba: g.rgba, width: g.width, height: g.height });
      }
      // uploaded texture decoded to RGBA
      if (decodedTextures.has(id)) return push(id, decodedTextures.get(id)!);
    }
    return textureForColor(mesh.color);
  };

  const gmaModels: GmaModelInput[] = [];
  const groups: SdGroup[] = [];

  // global wormhole indexing follows (group order, object order)
  const wormholeGlobalIndex = new Map<string, number>();
  let wormholeCounter = 0;
  for (const group of doc.itemGroups) {
    for (const o of doc.objects) {
      if (o.groupId === group.id && o.type === 'wormhole') {
        wormholeGlobalIndex.set(o.id, wormholeCounter++);
      }
    }
  }
  const groupIndexById = new Map<string, number>(doc.itemGroups.map((g, i) => [g.id, i]));

  for (let gi = 0; gi < doc.itemGroups.length; gi++) {
    const group = doc.itemGroups[gi];
    const meshes = doc.meshes.filter((m) => m.groupId === group.id && m.visible);
    const objects = doc.objects.filter((o) => o.groupId === group.id);

    // Bake all meshes; one GMA model per item group
    const triangleArrays: Float32Array[] = [];
    const model: GmaModelInput = { name: `IG${gi}`, materials: [], meshes: [] };
    const materialForTexture = new Map<number, number>();
    for (const mesh of meshes) {
      const baked = bakeMesh(mesh);
      triangleArrays.push(baked.triangles);
      const textureIdx = textureForMesh(mesh);
      let materialIdx = materialForTexture.get(textureIdx);
      if (materialIdx === undefined) {
        materialIdx = model.materials.length;
        model.materials.push({ textureIndex: textureIdx });
        materialForTexture.set(textureIdx, materialIdx);
      }
      model.meshes.push({ materialIndex: materialIdx, vertices: baked.vertices });
    }
    const hasModel = model.meshes.length > 0;
    if (hasModel) gmaModels.push(model);

    const totalTriFloats = triangleArrays.reduce((a, t) => a + t.length, 0);
    const triangles = new Float32Array(totalTriFloats);
    let cursor = 0;
    for (const t of triangleArrays) {
      triangles.set(t, cursor);
      cursor += t.length;
    }

    const pick = <T extends StageObject['type']>(type: T) =>
      objects.filter((o): o is Extract<StageObject, { type: T }> => o.type === type);

    const anim = group.animation;
    groups.push({
      rotationCenter: group.rotationCenter,
      initialRotation: { x: 0, y: 0, z: 0 },
      animGroupId: gi,
      animation: anim
        ? {
            loopType: anim.loopMode === 'playOnce' ? 1 : 0,
            loopTime: anim.duration,
            initialState: 0,
            channels: {
              rotX: anim.rotX.map(mapKeyframe),
              rotY: anim.rotY.map(mapKeyframe),
              rotZ: anim.rotZ.map(mapKeyframe),
              posX: anim.posX.map(mapKeyframe),
              posY: anim.posY.map(mapKeyframe),
              posZ: anim.posZ.map(mapKeyframe),
            },
          }
        : undefined,
      seesaw: group.seesaw
        ? {
            sensitivity: group.seesaw.sensitivity,
            friction: group.seesaw.resetStiffness,
            spring: group.seesaw.rotationBounds,
          }
        : undefined,
      triangles,
      modelNames: hasModel ? [model.name] : [],
      goals: pick('goal').map((g) => ({
        position: g.position,
        rotation: g.rotation,
        type: GOAL_TYPE[g.variant],
        castShadow: true,
      })),
      bumpers: pick('bumper').map((b) => ({ position: b.position, rotation: b.rotation, scale: b.scale })),
      jamabars: pick('jamabar').map((j) => ({ position: j.position, rotation: j.rotation, scale: j.scale })),
      bananas: pick('banana').map((b) => ({ position: b.position, type: BANANA_TYPE[b.variant] })),
      cones: pick('collisionShape')
        .filter((c) => c.shape === 'cone')
        .map((c) => ({
          position: c.position,
          rotation: c.rotation,
          radius: 0.5 * c.scale.x,
          height: c.scale.y,
        })),
      spheres: pick('collisionShape')
        .filter((c) => c.shape === 'sphere')
        .map((c) => ({ position: c.position, radius: 0.5 * c.scale.x })),
      cylinders: pick('collisionShape')
        .filter((c) => c.shape === 'cylinder')
        .map((c) => ({
          position: c.position,
          rotation: c.rotation,
          radius: 0.5 * c.scale.x,
          height: c.scale.y,
        })),
      switches: pick('switch').map((s) => ({
        position: s.position,
        rotation: s.rotation,
        playbackState: SWITCH_STATE[s.kind],
        animGroupId: s.targetGroupId ? (groupIndexById.get(s.targetGroupId) ?? 0) : 0,
      })),
      wormholes: pick('wormhole').map((wh) => ({
        position: wh.position,
        rotation: wh.rotation,
        destinationIndex: wh.destinationId
          ? (wormholeGlobalIndex.get(wh.destinationId) ?? wormholeGlobalIndex.get(wh.id)!)
          : wormholeGlobalIndex.get(wh.id)!, // unlinked wormholes loop to themselves
      })),
      textureScroll: group.textureScroll,
    });
  }

  const stageDef: StageDefInput = {
    falloutY: doc.falloutY,
    start: { position: doc.start.position, rotation: doc.start.rotation },
    groups,
    backgrounds: [],
  };

  return { stageDef, gmaModels, tplTextures };
}

function mapKeyframe(k: { time: number; value: number; easing: 'constant' | 'linear' | 'ease' }) {
  return { time: k.time, value: k.value, easing: EASING[k.easing] };
}

/** 8x8 solid-color CMPR-friendly texture from a hex color */
function solidTexture(hex: string): TplTextureInput {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  const rgba = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, width: 8, height: 8 };
}
