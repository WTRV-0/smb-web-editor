// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildExampleStage } from './exampleStage';
import { buildExport } from '../export/buildExport';
import { exportStageFile } from '../library/projectFile';
import { writeStageDef } from '../formats/stagedef/write';
import { lzCompress, lzDecompress } from '../formats/lz/lzss';

describe('example stage', () => {
  it('builds a valid document showcasing key features', () => {
    const doc = buildExampleStage();
    expect(doc.meshes.length).toBeGreaterThanOrEqual(6);
    expect(doc.itemGroups).toHaveLength(2);
    // spinner group is animated with rotation keyframes
    const spinner = doc.itemGroups.find((g) => g.id === 'ig-spinner');
    expect(spinner?.animation?.rotY).toHaveLength(2);
    // has goals, a bunch, bumpers, a switch and a linked wormhole pair
    expect(doc.objects.filter((o) => o.type === 'goal').length).toBeGreaterThanOrEqual(1);
    const bunch = doc.objects.find((o) => o.type === 'banana' && o.variant === 'bunch');
    expect(bunch).toBeTruthy();
    const worms = doc.objects.filter((o) => o.type === 'wormhole');
    expect(worms).toHaveLength(2);
    expect(worms[0].type === 'wormhole' && worms[0].destinationId).toBe(worms[1].id);
    // floors use the built-in grass texture
    expect(doc.meshes.some((m) => m.textureId === 'builtin:grass')).toBe(true);
    // a switch targets the spinner group
    const sw = doc.objects.find((o) => o.type === 'switch');
    expect(sw && sw.type === 'switch' && sw.targetGroupId).toBe('ig-spinner');
  });

  it('exports to valid stage files with baked textures', () => {
    const doc = buildExampleStage();
    const { stageDef, gmaModels, tplTextures } = buildExport(doc);
    expect(stageDef.groups).toHaveLength(2);
    // the animated group carries keyframes through to the stagedef input
    expect(stageDef.groups[1].animation?.channels.rotY).toHaveLength(2);
    // built-in + textured meshes produce baked TPL textures
    expect(tplTextures.length).toBeGreaterThan(0);
    expect(gmaModels.length).toBeGreaterThan(0);
    // stagedef writes and the lz round-trips
    const raw = writeStageDef(stageDef);
    expect(lzDecompress(lzCompress(raw))).toEqual(raw);
  });

  it('round-trips through a .smbstage file', () => {
    const doc = buildExampleStage();
    const blob = exportStageFile(doc, 'data:image/jpeg;base64,abc');
    // Blob text() isn't available synchronously in jsdom; re-serialize to check shape
    const json = JSON.parse(JSON.stringify({ format: 'smbstage', version: 1, document: doc }));
    expect(json.format).toBe('smbstage');
    expect(json.document.name).toBe(doc.name);
    expect(json.document.meshes).toHaveLength(doc.meshes.length);
    expect(blob.type).toBe('application/json');
  });
});
