// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { newObject, newPrimitiveMesh, newStageDocument } from '../model/defaults';
import { buildExport } from './buildExport';
import { writeStageDef } from '../formats/stagedef/write';
import { lzCompress, lzDecompress } from '../formats/lz/lzss';
import { writeGma } from '../formats/gma/write';
import { writeTpl } from '../formats/tpl/write';

describe('end-to-end export', () => {
  it('turns the default document into valid stage files', () => {
    const doc = newStageDocument('Test');
    // add one of everything
    doc.meshes.push(newPrimitiveMesh('ramp'));
    doc.objects.push(newObject('banana'), newObject('bumper'), newObject('jamabar'), newObject('switch'));
    const whA = newObject('wormhole');
    const whB = newObject('wormhole');
    if (whA.type === 'wormhole' && whB.type === 'wormhole') {
      whA.destinationId = whB.id;
      whB.destinationId = whA.id;
    }
    doc.objects.push(whA, whB);

    const { stageDef, gmaModels, tplTextures } = buildExport(doc);
    expect(stageDef.groups).toHaveLength(1);
    const g = stageDef.groups[0];
    expect(g.triangles.length % 9).toBe(0);
    expect(g.triangles.length).toBeGreaterThan(0);
    expect(g.goals).toHaveLength(1);
    expect(g.wormholes[0].destinationIndex).toBe(1);
    expect(g.wormholes[1].destinationIndex).toBe(0);
    expect(gmaModels).toHaveLength(1);
    expect(gmaModels[0].meshes.length).toBe(2); // floor + ramp
    expect(tplTextures.length).toBeGreaterThan(0);

    const raw = writeStageDef(stageDef);
    expect(raw.length).toBeGreaterThan(4096);
    const lz = lzCompress(raw);
    expect(lzDecompress(lz)).toEqual(raw);
    const gma = writeGma(gmaModels);
    expect(gma.length).toBeGreaterThan(0x60);
    const tpl = writeTpl(tplTextures);
    expect(tpl.length).toBeGreaterThan(0x20);
  });

  it('splits animated groups into separate collision headers', () => {
    const doc = newStageDocument('Anim');
    doc.itemGroups.push({
      id: 'mover',
      name: 'Mover',
      rotationCenter: { x: 0, y: 0, z: 0 },
      animation: {
        loopMode: 'loop',
        duration: 5,
        posX: [
          { time: 0, value: 0, easing: 'linear' },
          { time: 5, value: 10, easing: 'linear' },
        ],
        posY: [],
        posZ: [],
        rotX: [],
        rotY: [],
        rotZ: [],
      },
    });
    const mesh = newPrimitiveMesh('box', 'mover');
    doc.meshes.push(mesh);
    const sw = newObject('switch');
    if (sw.type === 'switch') sw.targetGroupId = 'mover';
    doc.objects.push(sw);

    const { stageDef } = buildExport(doc);
    expect(stageDef.groups).toHaveLength(2);
    expect(stageDef.groups[1].animation?.channels.posX).toHaveLength(2);
    expect(stageDef.groups[0].switches[0].animGroupId).toBe(1);
    // writes without offset drift
    expect(() => writeStageDef(stageDef)).not.toThrow();
  });
});
