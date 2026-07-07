import type { StageDocument } from '../model/types';
import { readIsoFile } from '../formats/gciso/read';
import { extractTplTexture, readTpl } from '../formats/tpl/read';
import type { GameTextureResolver } from './buildExport';

/**
 * For every game-texture reference used by the given documents, pull the raw
 * texture block from the matching stock stage's TPL inside the user's ISO.
 * Each donor TPL is read once. Missing donors/indices are skipped (they fall
 * back to the grass checker at export).
 */
export async function resolveGameTextures(iso: File, docs: StageDocument[]): Promise<GameTextureResolver> {
  const refs = new Map<string, { donor: number; index: number }>();
  for (const doc of docs) {
    for (const t of doc.textures ?? []) {
      if (t.kind === 'game' && t.donorStageId != null && t.textureIndex != null) {
        refs.set(t.id, { donor: t.donorStageId, index: t.textureIndex });
      }
    }
  }

  const donorTpls = new Map<number, ReturnType<typeof readTpl> | null>();
  for (const { donor } of refs.values()) {
    if (donorTpls.has(donor)) continue;
    const bytes = await readIsoFile(iso, `st${String(donor).padStart(3, '0')}.tpl`);
    donorTpls.set(donor, bytes ? safeRead(bytes) : null);
  }

  const resolver: GameTextureResolver = new Map();
  for (const [id, { donor, index }] of refs) {
    const tpl = donorTpls.get(donor);
    if (!tpl) continue;
    try {
      resolver.set(id, extractTplTexture(tpl, index));
    } catch {
      /* index out of range — skip, falls back at export */
    }
  }
  return resolver;
}

function safeRead(bytes: Uint8Array): ReturnType<typeof readTpl> | null {
  try {
    return readTpl(bytes);
  } catch {
    return null;
  }
}
