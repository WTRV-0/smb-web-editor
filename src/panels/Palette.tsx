import { useRef } from 'react';
import { useEditor } from '../state/store';
import { newObject, newPrimitiveMesh } from '../model/defaults';
import type { PrimitiveKind, StageObject, StageObjectType } from '../model/types';
import { importModelFile } from '../editor/importModel';

const PRIMITIVES: { kind: PrimitiveKind; label: string; icon: string }[] = [
  { kind: 'box', label: 'Box', icon: '▭' },
  { kind: 'ramp', label: 'Ramp', icon: '◺' },
  { kind: 'cylinder', label: 'Cylinder', icon: '⬤' },
  { kind: 'wedge', label: 'Wedge', icon: '◣' },
  { kind: 'arcRamp', label: 'Arc Ramp', icon: '◠' },
  { kind: 'stairs', label: 'Stairs', icon: '𝄜' },
  { kind: 'tube', label: 'Half-pipe', icon: '⌣' },
  { kind: 'funnel', label: 'Funnel', icon: '▽' },
  { kind: 'cone', label: 'Cone', icon: '△' },
  { kind: 'torus', label: 'Torus', icon: '◎' },
];

/** A palette entry can pre-set a variant/field on the created object. */
interface ObjectSpec {
  type: StageObjectType;
  label: string;
  icon: string;
  apply?: (o: StageObject) => void;
}

const OBJECTS: ObjectSpec[] = [
  { type: 'goal', label: 'Goal', icon: '🏁' },
  { type: 'banana', label: 'Banana', icon: '🍌', apply: (o) => o.type === 'banana' && (o.variant = 'single') },
  {
    type: 'banana',
    label: 'Bunch',
    icon: '🍇',
    apply: (o) => {
      if (o.type === 'banana') {
        o.variant = 'bunch';
        o.name = o.name.replace('Banana', 'Bunch');
      }
    },
  },
  { type: 'bumper', label: 'Bumper', icon: '🛞' },
  { type: 'jamabar', label: 'Jamabar', icon: '▮' },
  { type: 'collisionShape', label: 'Collider', icon: '◈' },
  { type: 'wormhole', label: 'Wormhole', icon: '🌀' },
  { type: 'switch', label: 'Switch', icon: '🔘' },
];

export function Palette() {
  const mutate = useEditor((s) => s.mutate);
  const select = useEditor((s) => s.select);
  const editMode = useEditor((s) => s.editMode);
  const fileInput = useRef<HTMLInputElement>(null);

  const addPrimitive = (kind: PrimitiveKind) => {
    const mesh = newPrimitiveMesh(kind);
    mutate((doc) => {
      doc.meshes.push(mesh);
    });
    select({ kind: 'mesh', id: mesh.id });
  };

  const addObject = (spec: ObjectSpec) => {
    const object = newObject(spec.type);
    spec.apply?.(object);
    mutate((doc) => {
      doc.objects.push(object);
    });
    select({ kind: 'object', id: object.id });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const mesh = await importModelFile(file);
      mutate((doc) => {
        doc.meshes.push(mesh);
      });
      select({ kind: 'mesh', id: mesh.id });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // In edit mode, adding new stage items would be confusing — disable the palette.
  const disabled = editMode !== null;

  return (
    <div className={`palette ${disabled ? 'palette-disabled' : ''}`}>
      <h3>Geometry</h3>
      <div className="palette-grid">
        {PRIMITIVES.map((p) => (
          <button key={p.kind} disabled={disabled} onClick={() => addPrimitive(p.kind)} title={`Add ${p.label}`}>
            <span className="palette-icon">{p.icon}</span>
            {p.label}
          </button>
        ))}
        <button disabled={disabled} onClick={() => fileInput.current?.click()} title="Import OBJ / glTF model">
          <span className="palette-icon">📦</span>
          Import
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".obj,.glb,.gltf"
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <h3>Objects</h3>
      <div className="palette-grid">
        {OBJECTS.map((o) => (
          <button
            key={o.label}
            disabled={disabled}
            onClick={() => addObject(o)}
            title={`Add ${o.label}`}
          >
            <span className="palette-icon">{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
