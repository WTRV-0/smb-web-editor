import { useEffect } from 'react';
import { TopBar } from './panels/TopBar';
import { Palette } from './panels/Palette';
import { Outliner } from './panels/Outliner';
import { Inspector } from './panels/Inspector';
import { Viewport } from './editor/Viewport';
import { PlayBar } from './editor/PlayBar';
import { ViewControls } from './editor/ViewControls';
import { BoxSelectRect, DragReadout, NumericTransform } from './editor/TransformHud';
import { EditToolbar, editDeleteComponents, editExtrude, editSelectAll } from './editor/EditToolbar';
import { Library } from './library/Library';
import { ShortcutsOverlay } from './panels/ShortcutsOverlay';
import { useEditor } from './state/store';

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
      const s = useEditor.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (s.editMode) s.exitEditMode();
        else if (s.selection?.kind === 'mesh') s.enterEditMode(s.selection.id);
        return;
      }
      // Global: shortcuts cheat sheet (? or /), duplicate, focus
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        s.setShortcutsOpen(!s.shortcutsOpen);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); // suppress browser save; edits already autosave
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        s.requestFocus();
        return;
      }

      if (s.editMode) {
        // edit-mode shortcuts: 1/2/3 component modes, G/R/S transform, E extrude
        if (e.key === '1') s.setEditComponentMode('vertex');
        else if (e.key === '2') s.setEditComponentMode('edge');
        else if (e.key === '3') s.setEditComponentMode('face');
        else if (e.key === 'g' || e.key === 'G') s.setEditTransformMode('translate');
        else if (e.key === 'r' || e.key === 'R') s.setEditTransformMode('rotate');
        else if (e.key === 's' || e.key === 'S') s.setEditTransformMode('scale');
        else if (e.key === 'e' || e.key === 'E') editExtrude();
        else if (e.key === 'a' || e.key === 'A') editSelectAll();
        else if (e.key === 'b' || e.key === 'B') s.toggleBoxSelect();
        else if (e.key === 'Delete' || e.key === 'Backspace') editDeleteComponents();
        else if (e.key === 'Escape') {
          if (s.boxSelectActive) s.setBoxSelectActive(false);
          else s.exitEditMode();
        }
        return;
      }

      // Camera: numpad-style view snaps + projection toggle
      if (e.key === '7') return void s.setView('top');
      if (e.key === '1') return void s.setView('front');
      if (e.key === '3') return void s.setView('side');
      if (e.key === '0') return void s.setView('home');
      if (e.key === '5') return void s.toggleProjection();
      // Enter opens numeric type-to-transform for the active gizmo mode
      if (e.key === 'Enter' && s.selection && s.selection.kind !== 'group') {
        e.preventDefault();
        s.openNumeric();
        return;
      }

      // G/W move, E rotate, R scale (G is the Blender muscle-memory alias)
      if (e.key === 'w' || e.key === 'W' || e.key === 'g' || e.key === 'G') s.setTransformMode('translate');
      else if (e.key === 'e' || e.key === 'E') s.setTransformMode('rotate');
      else if (e.key === 'r' || e.key === 'R') s.setTransformMode('scale');
      else if (e.key === 's' || e.key === 'S') s.toggleSnap();
      else if (e.key === 'h' || e.key === 'H') s.toggleSelectedVisibility();
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = s.selection;
        if (sel && sel.kind !== 'start') {
          s.mutate((doc) => {
            if (sel.kind === 'mesh') doc.meshes = doc.meshes.filter((m) => m.id !== sel.id);
            else if (sel.kind === 'object') doc.objects = doc.objects.filter((o) => o.id !== sel.id);
            else if (sel.kind === 'group') {
              doc.itemGroups = doc.itemGroups.filter((g) => g.id !== sel.id);
            }
          });
          s.select(null);
        }
      } else if (e.key === 'Escape') {
        if (s.shortcutsOpen) s.setShortcutsOpen(false);
        else s.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  useKeyboardShortcuts();
  const libraryOpen = useEditor((s) => s.libraryOpen);
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <div className="left-panel">
          <Palette />
          <Outliner />
        </div>
        <div className="viewport-container">
          <Viewport />
          <ViewControls />
          <EditToolbar />
          <BoxSelectRect />
          <DragReadout />
          <NumericTransform />
          <PlayBar />
        </div>
        <div className="right-panel">
          <Inspector />
        </div>
      </div>
      {libraryOpen && <Library />}
      <ShortcutsOverlay />
    </div>
  );
}
