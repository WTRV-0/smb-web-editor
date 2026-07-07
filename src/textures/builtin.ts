/**
 * Built-in stage textures, generated procedurally in-house (original art — no
 * game assets are bundled). Each texture is available both as a data URL for
 * the editor preview and as raw RGBA for baking into the exported .tpl, so the
 * look is identical in the editor and in-game.
 *
 * The default grass checkerboard is a plain two-tone checker (a generic
 * pattern) with light noise for a grassy feel.
 */

export interface BuiltinTexture {
  id: string;
  name: string;
}

export const BUILTIN_TEXTURES: BuiltinTexture[] = [
  { id: 'builtin:grass', name: 'Grass checker' },
  { id: 'builtin:stone', name: 'Stone checker' },
  { id: 'builtin:wood', name: 'Wood planks' },
  { id: 'builtin:ice', name: 'Ice checker' },
  { id: 'builtin:sand', name: 'Sand' },
];

export const DEFAULT_FLOOR_TEXTURE = 'builtin:grass';

export function isBuiltinTexture(id: string | undefined): id is string {
  return !!id && id.startsWith('builtin:');
}

export interface RenderedTexture {
  dataUrl: string;
  rgba: Uint8Array;
  width: number;
  height: number;
}

const cache = new Map<string, RenderedTexture>();

export function getBuiltinTexture(id: string): RenderedTexture {
  const existing = cache.get(id);
  if (existing) return existing;
  const rendered = render(id);
  cache.set(id, rendered);
  return rendered;
}

const SIZE = 64;

const FALLBACK_COLOR: Record<string, [number, number, number]> = {
  'builtin:grass': [76, 152, 84],
  'builtin:stone': [138, 138, 148],
  'builtin:ice': [170, 212, 234],
  'builtin:sand': [214, 196, 150],
  'builtin:wood': [150, 96, 56],
};

function render(id: string): RenderedTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // No 2D canvas (headless/test): fall back to a flat color so export still works.
    const [r, g, b] = FALLBACK_COLOR[id] ?? [120, 120, 120];
    const rgba = new Uint8Array(SIZE * SIZE * 4);
    for (let p = 0; p < SIZE * SIZE; p++) {
      rgba[p * 4] = r;
      rgba[p * 4 + 1] = g;
      rgba[p * 4 + 2] = b;
      rgba[p * 4 + 3] = 255;
    }
    return { dataUrl: '', rgba, width: SIZE, height: SIZE };
  }
  const img = ctx.createImageData(SIZE, SIZE);
  switch (id) {
    case 'builtin:grass':
      checker(img, 8, [86, 168, 92], [64, 138, 76], 16);
      break;
    case 'builtin:stone':
      checker(img, 8, [156, 156, 164], [122, 122, 132], 10);
      break;
    case 'builtin:ice':
      checker(img, 6, [188, 224, 240], [150, 200, 228], 8);
      break;
    case 'builtin:sand':
      noiseFill(img, [214, 196, 150], 18);
      break;
    case 'builtin:wood':
      planks(img);
      break;
    default:
      checker(img, 8, [120, 120, 120], [90, 90, 90], 0);
  }
  ctx.putImageData(img, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    rgba: new Uint8Array(img.data.buffer.slice(0)),
    width: SIZE,
    height: SIZE,
  };
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

function checker(img: ImageData, cells: number, a: number[], b: number[], noise: number): void {
  const cell = SIZE / cells;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const base = on ? a : b;
      const n = (Math.random() * 2 - 1) * noise;
      const i = (y * SIZE + x) * 4;
      img.data[i] = clamp(base[0] + n);
      img.data[i + 1] = clamp(base[1] + n);
      img.data[i + 2] = clamp(base[2] + n);
      img.data[i + 3] = 255;
    }
  }
}

function noiseFill(img: ImageData, base: number[], noise: number): void {
  for (let p = 0; p < SIZE * SIZE; p++) {
    const n = (Math.random() * 2 - 1) * noise;
    const i = p * 4;
    img.data[i] = clamp(base[0] + n);
    img.data[i + 1] = clamp(base[1] + n);
    img.data[i + 2] = clamp(base[2] + n);
    img.data[i + 3] = 255;
  }
}

function planks(img: ImageData): void {
  const plankH = SIZE / 4;
  for (let y = 0; y < SIZE; y++) {
    const plank = Math.floor(y / plankH);
    const seam = y % plankH < 1.5;
    for (let x = 0; x < SIZE; x++) {
      const grain = Math.sin((x + plank * 17) * 0.5) * 8;
      const n = (Math.random() * 2 - 1) * 8;
      const base = 150 + plank * 6 + grain + n;
      const i = (y * SIZE + x) * 4;
      const dark = seam ? 40 : 0;
      img.data[i] = clamp(base - dark);
      img.data[i + 1] = clamp(base * 0.62 - dark);
      img.data[i + 2] = clamp(base * 0.36 - dark);
      img.data[i + 3] = 255;
    }
  }
}
