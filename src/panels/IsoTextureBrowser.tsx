import { useRef, useState } from 'react';
import { useEditor } from '../state/store';
import { newId } from '../model/defaults';
import { listStageTpls, readIsoFile } from '../formats/gciso/read';
import { readTpl } from '../formats/tpl/read';
import { decodeTexture, GX_FORMATS, rgbaToDataUrl } from '../formats/tpl/decode';
import { setGamePreview } from '../textures/gamePreview';

interface BrowsedTexture {
  index: number;
  dataUrl: string;
  format: number;
  width: number;
  height: number;
}

/**
 * Browse the textures inside the user's own SMB2 ISO and add references to
 * them. Only a reference (donor stage + index) is stored in the document — the
 * pixels stay in the ISO and are copied into the stage at patch time.
 */
export function IsoTextureBrowser({ onClose }: { onClose: () => void }) {
  const mutate = useEditor((s) => s.mutate);
  const [iso, setIso] = useState<File | null>(null);
  const [stages, setStages] = useState<number[]>([]);
  const [stage, setStage] = useState<number | null>(null);
  const [textures, setTextures] = useState<BrowsedTexture[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const isoInput = useRef<HTMLInputElement>(null);

  const loadIso = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setIso(file);
    setStage(null);
    setTextures([]);
    setBusy(true);
    try {
      const list = await listStageTpls(file);
      if (list.length === 0) throw new Error('No stage textures found — is this an SMB2 ISO?');
      setStages(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const openStage = async (num: number) => {
    if (!iso) return;
    setStage(num);
    setTextures([]);
    setBusy(true);
    setError(null);
    try {
      const bytes = await readIsoFile(iso, `st${String(num).padStart(3, '0')}.tpl`);
      if (!bytes) throw new Error(`st${num}.tpl not found`);
      const tpl = readTpl(bytes);
      const decoded: BrowsedTexture[] = tpl.entries.map((e, index) => ({
        index,
        format: e.format,
        width: e.width,
        height: e.height,
        dataUrl: e.dataLength > 0 ? rgbaToDataUrl(decodeTexture(e.format, tpl.data.slice(e.dataOffset, e.dataOffset + e.dataLength), e.width, e.height), e.width, e.height) : '',
      }));
      setTextures(decoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const addTexture = (tex: BrowsedTexture) => {
    if (stage == null) return;
    const id = newId();
    const name = `Stage ${stage} · #${tex.index}`;
    mutate((d) => {
      d.textures = d.textures ?? [];
      d.textures.push({ id, name, kind: 'game', donorStageId: stage, textureIndex: tex.index });
    });
    setGamePreview(id, tex.dataUrl);
    setAdded((prev) => new Set(prev).add(`${stage}:${tex.index}`));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal iso-tex-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iso-tex-content">
          <h2>Use a texture from your ISO</h2>
          <p className="hint">
            Pick textures from your own SMB2 ISO. Only a reference is saved — the texture is copied from your ISO into
            the stage when you Patch ISO, so no game art is stored in this tool or in shared stages.
          </p>
          <div className="iso-tex-top">
            <button onClick={() => isoInput.current?.click()}>{iso ? iso.name : 'Choose ISO…'}</button>
            <input
              ref={isoInput}
              type="file"
              accept=".iso,.gcm"
              hidden
              onChange={(e) => void loadIso(e.target.files?.[0])}
            />
            {stages.length > 0 && (
              <select value={stage ?? ''} onChange={(e) => void openStage(parseInt(e.target.value))}>
                <option value="" disabled>
                  Choose a stage… ({stages.length})
                </option>
                {stages.map((n) => (
                  <option key={n} value={n}>
                    Stage {n}
                  </option>
                ))}
              </select>
            )}
            {busy && <span className="hint">Reading…</span>}
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="iso-tex-grid">
            {textures.map((t) => {
              const isAdded = added.has(`${stage}:${t.index}`);
              return (
                <button
                  key={t.index}
                  className={`iso-tex-cell ${isAdded ? 'added' : ''}`}
                  title={`${GX_FORMATS[t.format] ?? `fmt ${t.format}`} · ${t.width}×${t.height}`}
                  onClick={() => addTexture(t)}
                >
                  {t.dataUrl ? <img src={t.dataUrl} alt="" /> : <span className="iso-tex-empty">empty</span>}
                  <span className="iso-tex-label">
                    #{t.index} {isAdded ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button className="modal-close-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
