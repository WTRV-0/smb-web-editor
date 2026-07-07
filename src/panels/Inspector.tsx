import { useMemo } from 'react';
import { findMesh, findObject, useEditor } from '../state/store';
import type { GroupAnimation, ItemGroup, Keyframe, PrimitiveParams, StageMesh, StageObject, Vec3 } from '../model/types';
import { buildGeometry } from '../editor/meshGeometry';
import { BUILTIN_TEXTURES } from '../textures/builtin';
import { BACKGROUND_THEMES } from '../textures/backgrounds';
import { NumberField, SelectField, TextField, Vec3Field } from './fields';

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc);

  let body: React.ReactNode;
  if (!selection) body = <StageSettings />;
  else if (selection.kind === 'start') body = <StartInspector />;
  else if (selection.kind === 'group') {
    const group = doc.itemGroups.find((g) => g.id === selection.id);
    body = group ? <GroupInspector group={group} /> : <StageSettings />;
  } else if (selection.kind === 'mesh') {
    const mesh = findMesh(doc, selection.id);
    body = mesh ? <MeshInspector mesh={mesh} /> : <StageSettings />;
  } else {
    const object = findObject(doc, selection.id);
    body = object ? <ObjectInspector object={object} /> : <StageSettings />;
  }

  return <div className="inspector">{body}</div>;
}

function TextureManager() {
  const doc = useEditor((s) => s.doc);
  const mutate = useEditor((s) => s.mutate);
  const textures = doc.textures ?? [];

  const upload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      mutate((d) => {
        d.textures = d.textures ?? [];
        d.textures.push({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, ''),
          dataUrl: reader.result as string,
        });
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <h4>Textures</h4>
      {textures.map((t) => (
        <div key={t.id} className="texture-row">
          <img src={t.dataUrl} alt="" />
          <span className="outliner-label">{t.name}</span>
          <button
            className="icon-btn"
            title="Delete texture"
            onClick={() =>
              mutate((d) => {
                d.textures = (d.textures ?? []).filter((x) => x.id !== t.id);
                for (const m of d.meshes) if (m.textureId === t.id) m.textureId = undefined;
              })
            }
          >
            ✕
          </button>
        </div>
      ))}
      <label className="field field-wide">
        <span>Upload</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <p className="hint">Textures are stored with the level and encoded to GameCube CMPR on export (resized to powers of two, max 512).</p>
    </>
  );
}

function StageSettings() {
  const doc = useEditor((s) => s.doc);
  const mutate = useEditor((s) => s.mutate);
  return (
    <>
      <h3>Stage Settings</h3>
      <TextField label="Name" value={doc.name} onChange={(name) => mutate((d) => void (d.name = name))} />
      <NumberField
        label="Time limit (s)"
        value={doc.timeLimit}
        step={5}
        onChange={(v) => mutate((d) => void (d.timeLimit = Math.max(1, Math.min(600, v))))}
      />
      <NumberField
        label="Fallout Y"
        value={doc.falloutY}
        step={1}
        onChange={(v) => mutate((d) => void (d.falloutY = v))}
      />
      <SelectField
        label="Background"
        value={doc.background}
        options={BACKGROUND_THEMES.map((b) => ({ value: b.id, label: b.name }))}
        onChange={(background) => mutate((d) => void (d.background = background))}
      />
      <TextureManager />
      <p className="hint">Select an item in the viewport or outliner to edit it. Click empty space to return here.</p>
    </>
  );
}

function StartInspector() {
  const start = useEditor((s) => s.doc.start);
  const mutate = useEditor((s) => s.mutate);
  return (
    <>
      <h3>Start Position</h3>
      <Vec3Field label="Position" value={start.position} onChange={(v) => mutate((d) => void (d.start.position = v))} />
      <Vec3Field
        label="Rotation °"
        value={start.rotation}
        step={15}
        onChange={(v) => mutate((d) => void (d.start.rotation = v))}
      />
    </>
  );
}

function GroupSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const groups = useEditor((s) => s.doc.itemGroups);
  return (
    <SelectField
      label="Item group"
      value={value}
      options={groups.map((g) => ({ value: g.id, label: g.name }))}
      onChange={onChange}
    />
  );
}

const CHANNELS: { key: keyof Pick<GroupAnimation, 'posX' | 'posY' | 'posZ' | 'rotX' | 'rotY' | 'rotZ'>; label: string }[] = [
  { key: 'posX', label: 'Position X' },
  { key: 'posY', label: 'Position Y' },
  { key: 'posZ', label: 'Position Z' },
  { key: 'rotX', label: 'Rotation X°' },
  { key: 'rotY', label: 'Rotation Y°' },
  { key: 'rotZ', label: 'Rotation Z°' },
];

function emptyAnimation(): GroupAnimation {
  return { loopMode: 'loop', duration: 10, posX: [], posY: [], posZ: [], rotX: [], rotY: [], rotZ: [] };
}

function GroupInspector({ group }: { group: ItemGroup }) {
  const mutate = useEditor((s) => s.mutate);
  const edit = (fn: (g: ItemGroup) => void) =>
    mutate((d) => {
      const g = d.itemGroups.find((x) => x.id === group.id);
      if (g) fn(g);
    });

  return (
    <>
      <h3>Item Group</h3>
      <TextField label="Name" value={group.name} onChange={(name) => edit((g) => void (g.name = name))} />
      <Vec3Field
        label="Rotation center (pivot)"
        value={group.rotationCenter}
        onChange={(v) => edit((g) => void (g.rotationCenter = v))}
      />

      <h4>Texture scroll</h4>
      <NumberField
        label="U speed"
        value={group.textureScroll?.u ?? 0}
        step={0.05}
        onChange={(v) => edit((g) => void (g.textureScroll = { u: v, v: g.textureScroll?.v ?? 0 }))}
      />
      <NumberField
        label="V speed"
        value={group.textureScroll?.v ?? 0}
        step={0.05}
        onChange={(v) => edit((g) => void (g.textureScroll = { u: g.textureScroll?.u ?? 0, v }))}
      />

      <h4>Seesaw</h4>
      <label className="field field-wide">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={!!group.seesaw}
          onChange={(e) =>
            edit((g) => {
              g.seesaw = e.target.checked
                ? { sensitivity: 0.5, resetStiffness: 8, rotationBounds: 0.8 }
                : undefined;
              if (e.target.checked) g.animation = undefined; // seesaw and animation are exclusive
            })
          }
        />
      </label>
      {group.seesaw && (
        <>
          <NumberField
            label="Sensitivity"
            value={group.seesaw.sensitivity}
            step={0.1}
            onChange={(v) => edit((g) => g.seesaw && (g.seesaw.sensitivity = v))}
          />
          <NumberField
            label="Reset stiffness"
            value={group.seesaw.resetStiffness}
            step={0.5}
            onChange={(v) => edit((g) => g.seesaw && (g.seesaw.resetStiffness = v))}
          />
          <NumberField
            label="Rotation bounds"
            value={group.seesaw.rotationBounds}
            step={0.1}
            onChange={(v) => edit((g) => g.seesaw && (g.seesaw.rotationBounds = v))}
          />
        </>
      )}

      <h4>Animation</h4>
      <label className="field field-wide">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={!!group.animation}
          disabled={!!group.seesaw}
          onChange={(e) =>
            edit((g) => {
              g.animation = e.target.checked ? emptyAnimation() : undefined;
            })
          }
        />
      </label>
      {group.animation && (
        <>
          <NumberField
            label="Duration (s)"
            value={group.animation.duration}
            step={0.5}
            onChange={(v) => edit((g) => g.animation && (g.animation.duration = Math.max(0.1, v)))}
          />
          <SelectField
            label="Loop mode"
            value={group.animation.loopMode}
            options={[
              { value: 'loop', label: 'Loop' },
              { value: 'playOnce', label: 'Play once' },
            ]}
            onChange={(v) => edit((g) => g.animation && (g.animation.loopMode = v))}
          />
          {CHANNELS.map((ch) => (
            <KeyframeChannel
              key={ch.key}
              label={ch.label}
              keyframes={group.animation![ch.key]}
              onChange={(keys) => edit((g) => g.animation && (g.animation[ch.key] = keys))}
            />
          ))}
          <p className="hint">Use the play bar under the viewport to preview. Keyframes are sorted by time automatically.</p>
        </>
      )}
    </>
  );
}

function KeyframeChannel({
  label,
  keyframes,
  onChange,
}: {
  label: string;
  keyframes: Keyframe[];
  onChange: (keys: Keyframe[]) => void;
}) {
  const update = (i: number, patch: Partial<Keyframe>) => {
    const next = keyframes.map((k, j) => (j === i ? { ...k, ...patch } : k));
    next.sort((a, b) => a.time - b.time);
    onChange(next);
  };

  return (
    <div className="keyframe-channel">
      <div className="keyframe-channel-head">
        <span>
          {label} ({keyframes.length})
        </span>
        <button
          className="icon-btn"
          title="Add keyframe"
          onClick={() => {
            const last = keyframes[keyframes.length - 1];
            onChange([...keyframes, { time: last ? last.time + 1 : 0, value: last?.value ?? 0, easing: 'linear' }]);
          }}
        >
          ＋
        </button>
      </div>
      {keyframes.map((k, i) => (
        <div key={i} className="keyframe-row">
          <input
            type="number"
            step={0.25}
            value={k.time}
            title="Time (s)"
            onChange={(e) => update(i, { time: parseFloat(e.target.value) || 0 })}
          />
          <input
            type="number"
            step={0.5}
            value={k.value}
            title="Value"
            onChange={(e) => update(i, { value: parseFloat(e.target.value) || 0 })}
          />
          <select
            value={k.easing}
            title="Easing"
            onChange={(e) => update(i, { easing: e.target.value as Keyframe['easing'] })}
          >
            <option value="constant">Const</option>
            <option value="linear">Linear</option>
            <option value="ease">Ease</option>
          </select>
          <button className="icon-btn" title="Remove" onClick={() => onChange(keyframes.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** Per-kind numeric parameter metadata: label, step, min, integer */
type ParamField = { key: string; label: string; step?: number; min?: number; integer?: boolean };
const PARAM_FIELDS: Record<PrimitiveParams['kind'], ParamField[]> = {
  box: [
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
    { key: 'depth', label: 'Depth' },
  ],
  ramp: [
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
    { key: 'depth', label: 'Depth' },
  ],
  wedge: [
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
    { key: 'depth', label: 'Depth' },
  ],
  cylinder: [
    { key: 'width', label: 'Diameter' },
    { key: 'height', label: 'Height' },
    { key: 'segments', label: 'Segments', step: 1, min: 3, integer: true },
  ],
  cone: [
    { key: 'radius', label: 'Radius' },
    { key: 'height', label: 'Height' },
    { key: 'segments', label: 'Segments', step: 1, min: 3, integer: true },
  ],
  torus: [
    { key: 'majorRadius', label: 'Ring radius' },
    { key: 'minorRadius', label: 'Tube radius' },
    { key: 'segmentsU', label: 'Ring segs', step: 1, min: 3, integer: true },
    { key: 'segmentsV', label: 'Tube segs', step: 1, min: 3, integer: true },
  ],
  arcRamp: [
    { key: 'innerRadius', label: 'Inner radius', min: 0 },
    { key: 'width', label: 'Track width' },
    { key: 'sweep', label: 'Sweep °', step: 15, min: 1 },
    { key: 'bank', label: 'Bank °', step: 5, min: -80 },
    { key: 'thickness', label: 'Thickness', step: 0.1 },
    { key: 'segments', label: 'Segments', step: 1, min: 2, integer: true },
  ],
  stairs: [
    { key: 'width', label: 'Width' },
    { key: 'rise', label: 'Total rise' },
    { key: 'run', label: 'Total run' },
    { key: 'steps', label: 'Steps', step: 1, min: 1, integer: true },
  ],
  tube: [
    { key: 'radius', label: 'Radius' },
    { key: 'thickness', label: 'Wall', step: 0.1 },
    { key: 'sweep', label: 'Sweep ° (180 = half-pipe)', step: 15, min: 10 },
    { key: 'length', label: 'Length' },
    { key: 'segments', label: 'Segments', step: 1, min: 3, integer: true },
  ],
  funnel: [
    { key: 'topRadius', label: 'Top radius' },
    { key: 'bottomRadius', label: 'Bottom radius' },
    { key: 'height', label: 'Height' },
    { key: 'thickness', label: 'Wall', step: 0.1 },
    { key: 'segments', label: 'Segments', step: 1, min: 3, integer: true },
  ],
};

function PrimitiveParamsEditor({
  mesh,
  params,
  edit,
}: {
  mesh: StageMesh;
  params: PrimitiveParams;
  edit: (fn: (m: StageMesh) => void) => void;
}) {
  const triCount = useMemo(() => {
    const g = buildGeometry(mesh);
    const n = g.getAttribute('position').count / 3;
    g.dispose();
    return n;
  }, [mesh.source]);

  return (
    <>
      <h4>Shape — {triCount} tris</h4>
      {PARAM_FIELDS[params.kind].map((f) => (
        <NumberField
          key={f.key}
          label={f.label}
          step={f.step}
          value={(params as unknown as Record<string, number>)[f.key] ?? 0}
          onChange={(v) =>
            edit((m) => {
              if (m.source.type !== 'primitive') return;
              let next = f.integer ? Math.round(v) : v;
              next = Math.max(f.min ?? 0.1, next);
              (m.source.params as unknown as Record<string, number>)[f.key] = next;
            })
          }
        />
      ))}
    </>
  );
}

function MeshInspector({ mesh }: { mesh: StageMesh }) {
  const mutate = useEditor((s) => s.mutate);
  const textures = useEditor((s) => s.doc.textures) ?? [];
  const edit = (fn: (m: StageMesh) => void) =>
    mutate((d) => {
      const m = d.meshes.find((x) => x.id === mesh.id);
      if (m) fn(m);
    });

  return (
    <>
      <h3>Mesh</h3>
      <TextField label="Name" value={mesh.name} onChange={(name) => edit((m) => void (m.name = name))} />
      <div className="field field-wide">
        <span>Geometry</span>
        <button
          onClick={() => {
            if (
              mesh.source.type !== 'editable' &&
              !confirm('Edit mode converts this shape to a free-form mesh; its parameters are baked in. Continue?')
            ) {
              return;
            }
            useEditor.getState().enterEditMode(mesh.id);
          }}
          title="Enter Blender-style edit mode (Tab)"
        >
          ✏ Edit Mesh
        </button>
      </div>
      <GroupSelect value={mesh.groupId} onChange={(id) => edit((m) => void (m.groupId = id))} />
      <Vec3Field
        label="Position"
        value={mesh.transform.position}
        onChange={(v) => edit((m) => void (m.transform.position = v))}
      />
      <Vec3Field
        label="Rotation °"
        value={mesh.transform.rotation}
        step={15}
        onChange={(v) => edit((m) => void (m.transform.rotation = v))}
      />
      <Vec3Field
        label="Scale"
        value={mesh.transform.scale}
        onChange={(v) => edit((m) => void (m.transform.scale = v))}
      />
      {mesh.source.type === 'primitive' && <PrimitiveParamsEditor mesh={mesh} params={mesh.source.params} edit={edit} />}
      <label className="field field-wide">
        <span>Color</span>
        <input type="color" value={mesh.color} onChange={(e) => edit((m) => void (m.color = e.target.value))} />
      </label>
      <SelectField
        label="Texture"
        value={mesh.textureId ?? ''}
        options={[
          { value: '', label: '— color only —' },
          ...BUILTIN_TEXTURES.map((t) => ({ value: t.id, label: t.name })),
          ...textures.map((t) => ({ value: t.id, label: `Uploaded: ${t.name}` })),
        ]}
        onChange={(v) => edit((m) => void (m.textureId = v || undefined))}
      />
    </>
  );
}

function ObjectInspector({ object }: { object: StageObject }) {
  const doc = useEditor((s) => s.doc);
  const mutate = useEditor((s) => s.mutate);
  const edit = (fn: (o: StageObject) => void) =>
    mutate((d) => {
      const o = d.objects.find((x) => x.id === object.id);
      if (o) fn(o);
    });
  const editVec = (key: 'position' | 'rotation') => (v: Vec3) => edit((o) => void (o[key] = v));

  return (
    <>
      <h3>{object.type[0].toUpperCase() + object.type.slice(1)}</h3>
      <TextField label="Name" value={object.name} onChange={(name) => edit((o) => void (o.name = name))} />
      <GroupSelect value={object.groupId} onChange={(id) => edit((o) => void (o.groupId = id))} />
      <Vec3Field label="Position" value={object.position} onChange={editVec('position')} />
      <Vec3Field label="Rotation °" value={object.rotation} step={15} onChange={editVec('rotation')} />
      {'scale' in object && (
        <Vec3Field
          label="Scale"
          value={object.scale}
          onChange={(v) => edit((o) => 'scale' in o && (o.scale = v))}
        />
      )}
      {object.type === 'goal' && (
        <SelectField
          label="Goal type"
          value={object.variant}
          options={[
            { value: 'blue', label: 'Blue (advance)' },
            { value: 'green', label: 'Green (skip 1)' },
            { value: 'red', label: 'Red (skip 2)' },
          ]}
          onChange={(v) => edit((o) => o.type === 'goal' && (o.variant = v))}
        />
      )}
      {object.type === 'banana' && (
        <SelectField
          label="Banana type"
          value={object.variant}
          options={[
            { value: 'single', label: 'Single (1)' },
            { value: 'bunch', label: 'Bunch (10)' },
          ]}
          onChange={(v) => edit((o) => o.type === 'banana' && (o.variant = v))}
        />
      )}
      {object.type === 'collisionShape' && (
        <SelectField
          label="Shape"
          value={object.shape}
          options={[
            { value: 'sphere', label: 'Sphere' },
            { value: 'cylinder', label: 'Cylinder' },
            { value: 'cone', label: 'Cone' },
          ]}
          onChange={(v) => edit((o) => o.type === 'collisionShape' && (o.shape = v))}
        />
      )}
      {object.type === 'wormhole' && (
        <SelectField
          label="Destination"
          value={object.destinationId ?? ''}
          options={[
            { value: '', label: '— none —' },
            ...doc.objects
              .filter((o) => o.type === 'wormhole' && o.id !== object.id)
              .map((o) => ({ value: o.id, label: o.name })),
          ]}
          onChange={(v) => edit((o) => o.type === 'wormhole' && (o.destinationId = v || undefined))}
        />
      )}
      {object.type === 'switch' && (
        <>
          <SelectField
            label="Action"
            value={object.kind}
            options={[
              { value: 'play', label: 'Play' },
              { value: 'stop', label: 'Stop' },
              { value: 'reverse', label: 'Reverse' },
              { value: 'rewind', label: 'Rewind' },
              { value: 'fastForward', label: 'Fast-forward' },
            ]}
            onChange={(v) => edit((o) => o.type === 'switch' && (o.kind = v))}
          />
          <SelectField
            label="Controls group"
            value={object.targetGroupId ?? ''}
            options={[
              { value: '', label: '— none —' },
              ...doc.itemGroups.map((g) => ({ value: g.id, label: g.name })),
            ]}
            onChange={(v) => edit((o) => o.type === 'switch' && (o.targetGroupId = v || undefined))}
          />
        </>
      )}
    </>
  );
}
