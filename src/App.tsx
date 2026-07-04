import { useEffect } from 'react';
import { TopBar } from './panels/TopBar';
import { Palette } from './panels/Palette';
import { Outliner } from './panels/Outliner';
import { Inspector } from './panels/Inspector';
import { Viewport } from './editor/Viewport';
import { PlayBar } from './editor/PlayBar';
import { EditToolbar, editDeleteComponents, editExtrude, editSelectAll } from './editor/EditToolbar';
import { Library } from './library/Library';
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
      if (s.editMode) {
        // edit-mode shortcuts
        if (e.key === '1') s.setEditComponentMode('vertex');
        else if (e.key === '2') s.setEditComponentMode('edge');
        else if (e.key === '3') s.setEditComponentMode('face');
        else if (e.key === 'e' || e.key === 'E') editExtrude();
        else if (e.key === 'a' || e.key === 'A') editSelectAll();
        else if (e.key === 'Delete' || e.key === 'Backspace') editDeleteComponents();
        else if (e.key === 'Escape') s.exitEditMode();
        return;
      }
      if (e.key === 'w' || e.key === 'W') s.setTransformMode('translate');
      else if (e.key === 'e' || e.key === 'E') s.setTransformMode('rotate');
      else if (e.key === 'r' || e.key === 'R') s.setTransformMode('scale');
      else if (e.key === 's' || e.key === 'S') s.toggleSnap();
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = s.selection;
        if (sel && sel.kind !== 'start') {
          s.mutate((doc) => {
            if (sel.kind === 'mesh') doc.meshes = doc.meshes.filter((m) => m.id !== sel.id);
            else if (sel.kind === 'object') doc.objects = doc.objects.filter((o) => o.id !== sel.id);
          });
          s.select(null);
        }
      } else if (e.key === 'Escape') s.select(null);
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
          <EditToolbar />
          <PlayBar />
        </div>
        <div className="right-panel">
          <Inspector />
        </div>
      </div>
      {libraryOpen && <Library />}
    </div>
  );
}
