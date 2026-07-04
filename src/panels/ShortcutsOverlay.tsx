import { useEditor } from '../state/store';

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Transform',
    rows: [
      ['W / G', 'Move (translate) gizmo'],
      ['E', 'Rotate gizmo'],
      ['R', 'Scale gizmo'],
      ['S', 'Toggle grid snapping'],
      ['F', 'Frame selection in view'],
    ],
  },
  {
    title: 'Editing',
    rows: [
      ['Ctrl/⌘ + Z', 'Undo'],
      ['Ctrl/⌘ + Y / Shift+Z', 'Redo'],
      ['Ctrl/⌘ + D', 'Duplicate selection'],
      ['H', 'Hide / show selected mesh'],
      ['Delete / Backspace', 'Delete selection'],
      ['Esc', 'Deselect'],
    ],
  },
  {
    title: 'Mesh edit mode',
    rows: [
      ['Tab', 'Enter / exit edit mode'],
      ['1 / 2 / 3', 'Vertex / Edge / Face select'],
      ['E', 'Extrude selected faces'],
      ['A', 'Select all / none'],
      ['Delete', 'Delete components'],
    ],
  },
  {
    title: 'General',
    rows: [
      ['?', 'Toggle this cheat sheet'],
      ['Ctrl/⌘ + S', 'Nothing — edits autosave'],
      ['Drag', 'Orbit • Scroll to zoom • Right-drag to pan'],
    ],
  },
];

export function ShortcutsOverlay() {
  const open = useEditor((s) => s.shortcutsOpen);
  const setOpen = useEditor((s) => s.setShortcutsOpen);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-content">
          <h2>⌨ Keyboard Shortcuts</h2>
          <div className="shortcuts-grid">
            {GROUPS.map((g) => (
              <div key={g.title} className="shortcuts-group">
                <h3>{g.title}</h3>
                {g.rows.map(([key, desc]) => (
                  <div key={key} className="shortcut-row">
                    <kbd>{key}</kbd>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <button className="modal-close-btn" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}
