import { useRef } from 'react';
import { useEditor } from '../state/store';
import { newObject, newPrimitiveMesh } from '../model/defaults';
import type { PrimitiveKind, StageObjectType } from '../model/types';
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

const OBJECTS: { type: StageObjectType; label: string; icon: string }[] = [
  { type: 'goal', label: 'Goal', icon: '🏁' },
  { type: 'banana', label: 'Banana', icon: '🍌' },
  { type: 'bumper', label: 'Bumper', icon: '🛞' },
  { type: 'jamabar', label: 'Jamabar', icon: '▮' },
  { type: 'collisionShape', label: 'Collider', icon: '◈' },
  { type: 'wormhole', label: 'Wormhole', icon: '🌀' },
  { type: 'switch', label: 'Switch', icon: '🔘' },
];

export function Palette() {
  const mutate = useEditor((s) => s.mutate);
  const select = useEditor((s) => s.select);
  const fileInput = useRef<HTMLInputElement>(null);

  const addPrimitive = (kind: PrimitiveKind) => {
    const mesh = newPrimitiveMesh(kind);
    mutate((doc) => {
      doc.meshes.push(mesh);
    });
    select({ kind: 'mesh', id: mesh.id });
  };

  const addObject = (type: StageObjectType) => {
    const object = newObject(type);
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

  return (
    <div className="palette">
      <h3>Geometry</h3>
      <div className="palette-grid">
        {PRIMITIVES.map((p) => (
          <button key={p.kind} onClick={() => addPrimitive(p.kind)} title={`Add ${p.label}`}>
            <span className="palette-icon">{p.icon}</span>
            {p.label}
          </button>
        ))}
        <button onClick={() => fileInput.current?.click()} title="Import OBJ / glTF model">
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
          <button key={o.type} onClick={() => addObject(o.type)} title={`Add ${o.label}`}>
            <span className="palette-icon">{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
