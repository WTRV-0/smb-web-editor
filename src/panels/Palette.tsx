import { useRef, type ComponentType } from 'react';
import { useEditor } from '../state/store';
import { newObject, newPrimitiveMesh } from '../model/defaults';
import type { PrimitiveKind, StageObject, StageObjectType } from '../model/types';
import { importModelFile } from '../editor/importModel';
import {
  ArcRampIcon,
  BananaIcon,
  BoxIcon,
  BumperIcon,
  BunchIcon,
  ColliderIcon,
  ConeIcon,
  CylinderIcon,
  FunnelIcon,
  GoalIcon,
  type IconProps,
  ImportIcon,
  JamabarIcon,
  RampIcon,
  StairsIcon,
  SwitchIcon,
  TorusIcon,
  TubeIcon,
  WedgeIcon,
  WormholeIcon,
} from '../ui/icons';

type Icon = ComponentType<IconProps>;

const PRIMITIVES: { kind: PrimitiveKind; label: string; Icon: Icon }[] = [
  { kind: 'box', label: 'Box', Icon: BoxIcon },
  { kind: 'ramp', label: 'Ramp', Icon: RampIcon },
  { kind: 'cylinder', label: 'Cylinder', Icon: CylinderIcon },
  { kind: 'wedge', label: 'Wedge', Icon: WedgeIcon },
  { kind: 'arcRamp', label: 'Arc Ramp', Icon: ArcRampIcon },
  { kind: 'stairs', label: 'Stairs', Icon: StairsIcon },
  { kind: 'tube', label: 'Half-pipe', Icon: TubeIcon },
  { kind: 'funnel', label: 'Funnel', Icon: FunnelIcon },
  { kind: 'cone', label: 'Cone', Icon: ConeIcon },
  { kind: 'torus', label: 'Torus', Icon: TorusIcon },
];

/** A palette entry can pre-set a variant/field on the created object. */
interface ObjectSpec {
  type: StageObjectType;
  label: string;
  Icon: Icon;
  apply?: (o: StageObject) => void;
}

const OBJECTS: ObjectSpec[] = [
  { type: 'goal', label: 'Goal', Icon: GoalIcon },
  { type: 'banana', label: 'Banana', Icon: BananaIcon, apply: (o) => o.type === 'banana' && (o.variant = 'single') },
  {
    type: 'banana',
    label: 'Bunch',
    Icon: BunchIcon,
    apply: (o) => {
      if (o.type === 'banana') {
        o.variant = 'bunch';
        o.name = o.name.replace('Banana', 'Bunch');
      }
    },
  },
  { type: 'bumper', label: 'Bumper', Icon: BumperIcon },
  { type: 'jamabar', label: 'Jamabar', Icon: JamabarIcon },
  { type: 'collisionShape', label: 'Collider', Icon: ColliderIcon },
  { type: 'wormhole', label: 'Wormhole', Icon: WormholeIcon },
  { type: 'switch', label: 'Switch', Icon: SwitchIcon },
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
            <span className="palette-icon icon-geo">
              <p.Icon />
            </span>
            {p.label}
          </button>
        ))}
        <button disabled={disabled} onClick={() => fileInput.current?.click()} title="Import OBJ / glTF model">
          <span className="palette-icon icon-geo">
            <ImportIcon />
          </span>
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
            <span className="palette-icon icon-obj">
              <o.Icon />
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
