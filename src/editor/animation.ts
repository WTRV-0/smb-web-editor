import type { GroupAnimation, Keyframe } from '../model/types';

/**
 * Evaluate a keyframe channel at time t, mirroring how SMB plays stagedef
 * animations closely enough for preview: constant holds, linear lerps,
 * ease uses smoothstep.
 */
export function evalChannel(keys: Keyframe[], t: number): number {
  if (keys.length === 0) return 0;
  const sorted = keys; // editor keeps channels sorted on edit
  if (t <= sorted[0].time) return sorted[0].value;
  if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t < a.time || t > b.time) continue;
    const span = b.time - a.time;
    if (span <= 0) return b.value;
    let f = (t - a.time) / span;
    if (b.easing === 'constant') return a.value;
    if (b.easing === 'ease') f = f * f * (3 - 2 * f);
    return a.value + (b.value - a.value) * f;
  }
  return sorted[sorted.length - 1].value;
}

export interface GroupPose {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

export function evalGroupAnimation(anim: GroupAnimation, time: number): GroupPose {
  const t = anim.loopMode === 'loop' && anim.duration > 0 ? time % anim.duration : Math.min(time, anim.duration);
  return {
    posX: evalChannel(anim.posX, t),
    posY: evalChannel(anim.posY, t),
    posZ: evalChannel(anim.posZ, t),
    rotX: evalChannel(anim.rotX, t),
    rotY: evalChannel(anim.rotY, t),
    rotZ: evalChannel(anim.rotZ, t),
  };
}

/** Longest animation duration in the document, for the preview scrubber */
export function maxAnimationDuration(groups: { animation?: GroupAnimation }[]): number {
  return groups.reduce((max, g) => Math.max(max, g.animation?.duration ?? 0), 0);
}
