// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildExport, type GameTextureResolver } from './buildExport';
import { newStageDocument } from '../model/defaults';
import { writeTpl } from '../formats/tpl/write';
import { readTpl } from '../formats/tpl/read';

describe('game-texture references in export', () => {
  function docWithGameTexture() {
    const doc = newStageDocument();
    doc.textures = [{ id: 'game-1', name: 'ISO tex', kind: 'game', donorStageId: 1, textureIndex: 2 }];
    doc.meshes[0].textureId = 'game-1'; // floor uses the game texture
    return doc;
  }

  it('embeds the resolved raw block verbatim when the ISO provides it', () => {
    const doc = docWithGameTexture();
    const raw = new Uint8Array(32).map((_, i) => (i * 7) & 0xff);
    const resolver: GameTextureResolver = new Map([
      ['game-1', { raw, format: 14, width: 8, height: 8, levelCount: 1 }],
    ]);
    const { tplTextures } = buildExport(doc, new Map(), resolver);
    // the floor's texture is the raw block, written back unchanged
    const tpl = writeTpl(tplTextures);
    const read = readTpl(tpl);
    const embedded = read.data.slice(read.entries[0].dataOffset, read.entries[0].dataOffset + read.entries[0].dataLength);
    expect(Array.from(embedded)).toEqual(Array.from(raw));
    expect(read.entries[0].format).toBe(14);
  });

  it('falls back to the grass checker when no ISO is available', () => {
    const doc = docWithGameTexture();
    const { tplTextures } = buildExport(doc); // no resolver
    // still produces a valid, writable TPL (grass fallback, not the raw block)
    expect(tplTextures.length).toBeGreaterThan(0);
    const tpl = writeTpl(tplTextures);
    expect(readTpl(tpl).entries.length).toBe(tplTextures.length);
  });
});
