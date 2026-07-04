/**
 * Vanilla SMB2 stage-slot mapping.
 *
 * Stage files (STAGExxx.lz + models) are just numbered containers; which one
 * the game loads for "Story 2-3" or "Challenge Beginner 1" is decided by
 * course tables inside mkb2.main_loop.rel. The story-mode table below is the
 * vanilla one, decoded from smb2-relmod's vanillaSMOrderInNewSMEntries.asm
 * (tuckergs), which preserves the vanilla order: each entry packs
 * difficulty | stageId | time-limit.
 *
 * Challenge-mode difficulties reference the same stage pool via separate
 * CourseCommand lists in the REL; those tables are not mirrored here yet
 * (they use a larger vanilla entry format). Replacing a story stage's file
 * also affects any challenge slot that references the same stage id.
 */

export interface StageSlot {
  label: string;
  stageId: number;
}

// Vanilla story-mode stage ids, world 1..10, stage 1..10 each
const STORY_IDS: number[][] = [
  [201, 202, 203, 204, 1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  [231, 232, 233, 234, 235, 236, 237, 238, 239, 17],
  [18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
  [38, 39, 40, 41, 42, 43, 44, 45, 46, 47],
  [281, 282, 283, 284, 285, 286, 287, 288, 289, 48],
  [49, 50, 51, 52, 53, 54, 55, 56, 57, 58],
  [59, 60, 61, 62, 63, 64, 65, 66, 67, 68],
  [341, 342, 343, 344, 345, 346, 347, 348, 349, 350],
];

export const STORY_SLOTS: StageSlot[] = STORY_IDS.flatMap((world, w) =>
  world.map((stageId, s) => ({ label: `Story ${w + 1}-${s + 1}`, stageId })),
);

export function slotLabelForStageId(stageId: number): string {
  const slot = STORY_SLOTS.find((s) => s.stageId === stageId);
  return slot ? `${slot.label} (STAGE${String(stageId).padStart(3, '0')})` : `STAGE${String(stageId).padStart(3, '0')}`;
}
