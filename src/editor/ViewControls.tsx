import { useEditor, type CameraView } from '../state/store';

const VIEWS: { view: CameraView; label: string; key: string }[] = [
  { view: 'top', label: 'Top', key: '7' },
  { view: 'front', label: 'Front', key: '1' },
  { view: 'side', label: 'Side', key: '3' },
  { view: 'home', label: '3D', key: '0' },
];

/** Floating viewport gizmo: snap views + perspective/orthographic toggle. */
export function ViewControls() {
  const setView = useEditor((s) => s.setView);
  const projection = useEditor((s) => s.projection);
  const toggleProjection = useEditor((s) => s.toggleProjection);

  return (
    <div className="view-controls">
      {VIEWS.map((v) => (
        <button key={v.view} onClick={() => setView(v.view)} title={`${v.label} view (${v.key})`}>
          {v.label}
        </button>
      ))}
      <button
        className={projection === 'orthographic' ? 'active' : ''}
        onClick={toggleProjection}
        title="Toggle perspective / orthographic (5)"
      >
        {projection === 'orthographic' ? 'Ortho' : 'Persp'}
      </button>
    </div>
  );
}
