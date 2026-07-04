/**
 * Capture a small JPEG thumbnail from the WebGL viewport canvas.
 * Requires the Canvas to be created with preserveDrawingBuffer.
 */
export function captureThumbnail(width = 320): string | undefined {
  const source = document.querySelector<HTMLCanvasElement>('.viewport-container canvas');
  if (!source || source.width === 0) return undefined;
  const height = Math.round((source.height / source.width) * width);
  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(source, 0, 0, width, height);
  return target.toDataURL('image/jpeg', 0.7);
}
