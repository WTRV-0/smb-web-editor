import { create } from 'zustand';
import type { EditableMesh, StageDocument, StageMesh, StageObject } from '../model/types';
import { newStageDocument } from '../model/defaults';
import { importedToEditable, primitiveToEditable } from '../editor/editableMesh';
import { db, DEFAULT_SET_ID, ensureDefaultSet } from '../library/db';
import { captureThumbnail } from '../editor/thumbnail';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export type EditComponentMode = 'vertex' | 'edge' | 'face';

export type CameraProjection = 'perspective' | 'orthographic';
export type CameraView = 'top' | 'front' | 'side' | 'home';

export interface DragReadout {
  mode: TransformMode;
  /** live values shown in the HUD (position, degrees, or scale factors) */
  values: [number, number, number];
}

export interface EditModeState {
  meshId: string;
  mode: EditComponentMode;
  /** vertex ids, face ids, or encoded edge keys depending on mode */
  selection: number[];
}

export type Selection =
  | { kind: 'mesh'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'start' }
  | null;

const HISTORY_LIMIT = 64;

interface EditorState {
  doc: StageDocument;
  /** setId the current doc is saved under */
  setId: string;
  selection: Selection;
  transformMode: TransformMode;
  snapEnabled: boolean;
  /** true while a gizmo drag is in progress (suppresses history capture until release) */
  saveState: 'saved' | 'saving' | 'dirty';
  libraryOpen: boolean;
  past: StageDocument[];
  future: StageDocument[];
  /** animation preview */
  previewPlaying: boolean;
  previewTime: number;
  setPreviewPlaying: (playing: boolean) => void;
  setPreviewTime: (time: number) => void;

  /** Blender-style mesh edit mode */
  editMode: EditModeState | null;
  enterEditMode: (meshId: string) => void;
  exitEditMode: () => void;
  setEditComponentMode: (mode: EditComponentMode) => void;
  setEditSelection: (selection: number[]) => void;
  /** Apply a pure editableMesh op to the mesh being edited (undoable). */
  applyEditOp: (
    op: (mesh: EditableMesh) => { mesh: EditableMesh; selection?: number[] },
    options?: { captureHistory?: boolean },
  ) => void;

  select: (sel: Selection) => void;
  setTransformMode: (mode: TransformMode) => void;
  toggleSnap: () => void;
  setLibraryOpen: (open: boolean) => void;
  /** Duplicate the selected mesh or object (offset slightly), selecting the copy. */
  duplicateSelection: () => void;
  /** Toggle visibility of the selected mesh. */
  toggleSelectedVisibility: () => void;
  /** Bumped to ask the viewport to frame the current selection (F key). */
  focusRequest: number;
  requestFocus: () => void;
  /** Whether the keyboard-shortcuts cheat sheet is open. */
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  /** Camera: perspective vs orthographic, plus snap-view requests. */
  projection: CameraProjection;
  toggleProjection: () => void;
  setProjection: (p: CameraProjection) => void;
  requestedView: CameraView | null;
  viewNonce: number;
  setView: (view: CameraView) => void;

  /** Transform mode used inside mesh edit mode (independent of object mode). */
  editTransformMode: TransformMode;
  setEditTransformMode: (mode: TransformMode) => void;

  /** Box (rectangle) select in edit mode. */
  boxSelectActive: boolean;
  toggleBoxSelect: () => void;
  setBoxSelectActive: (active: boolean) => void;
  /** Live rectangle in canvas pixels while box-selecting (null when idle). */
  boxSelectRect: { x0: number; y0: number; x1: number; y1: number } | null;
  setBoxSelectRect: (rect: { x0: number; y0: number; x1: number; y1: number } | null) => void;

  /** Live gizmo-drag HUD (null when not dragging). */
  dragReadout: DragReadout | null;
  setDragReadout: (r: DragReadout | null) => void;

  /** Numeric type-to-transform popover. */
  numericOpen: boolean;
  openNumeric: () => void;
  closeNumeric: () => void;

  /** Apply a mutation to the document, recording undo history and scheduling autosave. */
  mutate: (fn: (doc: StageDocument) => void, options?: { captureHistory?: boolean }) => void;
  /** Capture an undo snapshot of the current doc (call before a gizmo drag begins). */
  captureSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  loadDocument: (doc: StageDocument, setId: string) => void;
  newDocument: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleAutosave(get: () => EditorState, set: (partial: Partial<EditorState>) => void) {
  set({ saveState: 'dirty' });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { doc, setId } = get();
    set({ saveState: 'saving' });
    await ensureDefaultSet();
    const thumbnail = captureThumbnail();
    const existing = await db.levels.get(doc.id);
    if (existing) {
      await db.levels.update(doc.id, { document: doc, ...(thumbnail ? { thumbnail } : {}) });
    } else {
      const count = await db.levels.where('setId').equals(setId).count();
      await db.levels.add({ id: doc.id, setId, slot: count, document: doc, thumbnail });
    }
    // Only mark saved if nothing changed while writing
    if (get().doc === doc) set({ saveState: 'saved' });
  }, 800);
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: newStageDocument(),
  setId: DEFAULT_SET_ID,
  selection: null,
  transformMode: 'translate',
  snapEnabled: true,
  saveState: 'dirty',
  libraryOpen: false,
  past: [],
  future: [],
  previewPlaying: false,
  previewTime: 0,
  setPreviewPlaying: (previewPlaying) => set({ previewPlaying }),
  setPreviewTime: (previewTime) => set({ previewTime }),

  editMode: null,

  enterEditMode: (meshId) => {
    const { doc, mutate } = get();
    const mesh = doc.meshes.find((m) => m.id === meshId);
    if (!mesh) return;
    if (mesh.source.type !== 'editable') {
      // bake to an editable polygon mesh (undoable via the doc snapshot)
      const editable =
        mesh.source.type === 'primitive'
          ? primitiveToEditable(mesh.source.params)
          : importedToEditable(mesh.source.geometry);
      mutate((d) => {
        const m = d.meshes.find((x) => x.id === meshId);
        if (m) m.source = { type: 'editable', mesh: editable };
      });
    }
    set({ editMode: { meshId, mode: 'face', selection: [] }, selection: { kind: 'mesh', id: meshId } });
  },

  exitEditMode: () => set({ editMode: null, boxSelectActive: false, boxSelectRect: null }),

  setEditComponentMode: (mode) => {
    const em = get().editMode;
    if (em) set({ editMode: { ...em, mode, selection: [] } });
  },

  setEditSelection: (selection) => {
    const em = get().editMode;
    if (em) set({ editMode: { ...em, selection } });
  },

  applyEditOp: (op, options) => {
    const em = get().editMode;
    if (!em) return;
    const doc = get().doc;
    const mesh = doc.meshes.find((m) => m.id === em.meshId);
    if (!mesh || mesh.source.type !== 'editable') return;
    const result = op(mesh.source.mesh);
    get().mutate((d) => {
      const m = d.meshes.find((x) => x.id === em.meshId);
      if (m) m.source = { type: 'editable', mesh: result.mesh };
    }, options);
    set({ editMode: { ...em, selection: result.selection ?? [] } });
  },

  select: (selection) => set({ selection }),
  setTransformMode: (transformMode) => set({ transformMode }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),

  focusRequest: 0,
  requestFocus: () => set((s) => ({ focusRequest: s.focusRequest + 1 })),
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

  projection: 'perspective',
  toggleProjection: () => set((s) => ({ projection: s.projection === 'perspective' ? 'orthographic' : 'perspective' })),
  setProjection: (projection) => set({ projection }),
  requestedView: null,
  viewNonce: 0,
  setView: (requestedView) =>
    set((s) => ({
      requestedView,
      viewNonce: s.viewNonce + 1,
      // orthographic reads best for the axis-aligned snap views
      projection: requestedView === 'home' ? s.projection : 'orthographic',
    })),

  editTransformMode: 'translate',
  setEditTransformMode: (editTransformMode) => set({ editTransformMode }),

  boxSelectActive: false,
  toggleBoxSelect: () => set((s) => ({ boxSelectActive: !s.boxSelectActive, boxSelectRect: null })),
  setBoxSelectActive: (boxSelectActive) => set({ boxSelectActive, boxSelectRect: null }),
  boxSelectRect: null,
  setBoxSelectRect: (boxSelectRect) => set({ boxSelectRect }),

  dragReadout: null,
  setDragReadout: (dragReadout) => set({ dragReadout }),

  numericOpen: false,
  openNumeric: () => {
    const s = get();
    if (!s.selection && !s.editMode) return;
    set({ numericOpen: true });
  },
  closeNumeric: () => set({ numericOpen: false }),

  duplicateSelection: () => {
    const { selection, doc } = get();
    if (!selection) return;
    if (selection.kind === 'mesh') {
      const src = doc.meshes.find((m) => m.id === selection.id);
      if (!src) return;
      const copy = structuredClone(src);
      copy.id = crypto.randomUUID();
      copy.name = `${src.name} copy`;
      copy.transform.position = {
        x: src.transform.position.x + 1,
        y: src.transform.position.y,
        z: src.transform.position.z + 1,
      };
      get().mutate((d) => void d.meshes.push(copy));
      set({ selection: { kind: 'mesh', id: copy.id } });
    } else if (selection.kind === 'object') {
      const src = doc.objects.find((o) => o.id === selection.id);
      if (!src) return;
      const copy = structuredClone(src);
      copy.id = crypto.randomUUID();
      copy.name = `${src.name} copy`;
      copy.position = { x: src.position.x + 1, y: src.position.y, z: src.position.z + 1 };
      get().mutate((d) => void d.objects.push(copy));
      set({ selection: { kind: 'object', id: copy.id } });
    }
  },

  toggleSelectedVisibility: () => {
    const { selection } = get();
    if (selection?.kind !== 'mesh') return;
    get().mutate((d) => {
      const m = d.meshes.find((x) => x.id === selection.id);
      if (m) m.visible = !m.visible;
    });
  },

  mutate: (fn, options) => {
    const { doc, past } = get();
    const next = structuredClone(doc);
    fn(next);
    next.modifiedAt = Date.now();
    const capture = options?.captureHistory ?? true;
    set({
      doc: next,
      past: capture ? [...past.slice(-HISTORY_LIMIT + 1), doc] : past,
      future: capture ? [] : get().future,
    });
    scheduleAutosave(get, set);
  },

  captureSnapshot: () => {
    const { doc, past } = get();
    set({ past: [...past.slice(-HISTORY_LIMIT + 1), structuredClone(doc)], future: [] });
  },

  undo: () => {
    const { past, doc, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future] });
    scheduleAutosave(get, set);
  },

  redo: () => {
    const { past, doc, future } = get();
    if (future.length === 0) return;
    const [next, ...rest] = future;
    set({ doc: next, past: [...past, doc], future: rest });
    scheduleAutosave(get, set);
  },

  loadDocument: (doc, setId) => {
    clearTimeout(saveTimer);
    set({ doc, setId, selection: null, past: [], future: [], saveState: 'saved', libraryOpen: false, editMode: null });
  },

  newDocument: () => {
    const doc = newStageDocument();
    set({ doc, selection: null, past: [], future: [], libraryOpen: false, editMode: null });
    scheduleAutosave(get, set);
  },
}));

/** Helpers to look up the selected entity */
export function findMesh(doc: StageDocument, id: string): StageMesh | undefined {
  return doc.meshes.find((m) => m.id === id);
}

export function findObject(doc: StageDocument, id: string): StageObject | undefined {
  return doc.objects.find((o) => o.id === id);
}
