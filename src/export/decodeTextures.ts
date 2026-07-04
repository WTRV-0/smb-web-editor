import type { StageDocument } from '../model/types';
import type { TplTextureInput } from '../formats/tpl/write';

/**
 * Decode uploaded data-URL textures to RGBA, resampled to power-of-two
 * dimensions (8..512) as GC hardware prefers.
 */
export async function decodeTextures(doc: StageDocument): Promise<Map<string, TplTextureInput>> {
  const out = new Map<string, TplTextureInput>();
  for (const tex of doc.textures ?? []) {
    try {
      out.set(tex.id, await decodeDataUrl(tex.dataUrl));
    } catch (err) {
      console.warn(`Failed to decode texture ${tex.name}:`, err);
    }
  }
  return out;
}

async function decodeDataUrl(dataUrl: string): Promise<TplTextureInput> {
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });
  const width = pot(img.naturalWidth);
  const height = pot(img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  return { rgba: new Uint8Array(data.data.buffer.slice(0)), width, height };
}

function pot(n: number): number {
  let p = 8;
  while (p < n && p < 512) p *= 2;
  // round down if the lower power of two is closer
  return p / 2 >= 8 && Math.abs(p / 2 - n) < Math.abs(p - n) ? p / 2 : p;
}
