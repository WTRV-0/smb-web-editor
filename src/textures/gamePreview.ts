/**
 * Session-only preview cache for game-texture references. When the user browses
 * their ISO, decoded thumbnails are stashed here (keyed by the document texture
 * id) so the editor can show the real texture during this session — but these
 * pixels are NEVER written to the document, IndexedDB, or shared .smbstage
 * files. Reload the page and previews revert to a placeholder until the ISO is
 * browsed again. This keeps copyrighted game art out of anything persisted.
 */
const previews = new Map<string, string>();

export function setGamePreview(textureId: string, dataUrl: string): void {
  previews.set(textureId, dataUrl);
}

export function getGamePreview(textureId: string): string | undefined {
  return previews.get(textureId);
}
