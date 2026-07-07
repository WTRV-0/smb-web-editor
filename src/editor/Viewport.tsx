import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, TransformControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEditor, type Selection } from '../state/store';
import type { ItemGroup, StageMesh, StageObject } from '../model/types';
import { buildGeometry } from './meshGeometry';
import { ObjectVisual, StartVisual } from './objectVisuals';
import { evalGroupAnimation } from './animation';
import { previewClock } from './previewClock';
import { EditModeOverlay, nearestEdgeOfFace, nearestVertexOfFace } from './EditModeOverlay';
import { CameraRig } from './CameraRig';
import { getBuiltinTexture, isBuiltinTexture } from '../textures/builtin';
import { getBackgroundSky } from '../textures/backgrounds';
import { getGamePreview } from '../textures/gamePreview';

const DEG = Math.PI / 180;

/** Registry mapping selection keys to live Object3Ds so the gizmo can attach. */
const nodeRegistry = new Map<string, THREE.Object3D>();

function selectionKey(sel: Selection): string | null {
  if (!sel) return null;
  return sel.kind === 'start' ? 'start' : `${sel.kind}:${sel.id}`;
}

function registerNode(key: string) {
  return (node: THREE.Object3D | null) => {
    if (node) nodeRegistry.set(key, node);
    else nodeRegistry.delete(key);
  };
}

const textureCache = new Map<string, THREE.Texture>();

function useMeshTexture(textureId: string | undefined): THREE.Texture | null {
  const ref = useEditor((s) => s.doc.textures?.find((t) => t.id === textureId));
  let dataUrl: string | undefined;
  if (isBuiltinTexture(textureId)) dataUrl = getBuiltinTexture(textureId).dataUrl;
  else if (ref?.kind === 'game') dataUrl = getGamePreview(ref.id) ?? getBuiltinTexture('builtin:stone').dataUrl;
  else dataUrl = ref?.dataUrl;
  return useMemo(() => {
    if (!textureId || !dataUrl) return null;
    // key on the actual image source so a game preview appearing later refreshes
    const key = `${textureId}|${dataUrl.length}`;
    let tex = textureCache.get(key);
    if (!tex) {
      tex = new THREE.TextureLoader().load(dataUrl);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(key, tex);
    }
    return tex;
  }, [textureId, dataUrl]);
}

function MeshEntity({ mesh }: { mesh: StageMesh }) {
  const select = useEditor((s) => s.select);
  const selected = useEditor((s) => s.selection?.kind === 'mesh' && s.selection.id === mesh.id);
  const editMode = useEditor((s) => s.editMode);
  const setEditSelection = useEditor((s) => s.setEditSelection);
  const geometry = useMemo(() => buildGeometry(mesh), [mesh.source]);
  const texture = useMeshTexture(mesh.textureId);
  const meshRef = useRef<THREE.Mesh>(null);
  const { position: p, rotation: r, scale: sc } = mesh.transform;
  if (!mesh.visible) return null;

  const editingThis = editMode?.meshId === mesh.id;
  const editingOther = editMode !== null && !editingThis;

  const onClick = (e: {
    stopPropagation: () => void;
    faceIndex?: number;
    point: THREE.Vector3;
    shiftKey?: boolean;
    nativeEvent?: MouseEvent;
  }) => {
    e.stopPropagation();
    if (editingOther) return; // clicks outside the edited mesh do nothing
    if (!editMode || !editingThis) {
      select({ kind: 'mesh', id: mesh.id });
      return;
    }
    // component picking inside edit mode
    if (mesh.source.type !== 'editable' || e.faceIndex === undefined) return;
    const editable = mesh.source.mesh;
    const faceMap = geometry.userData.faceMap as number[] | undefined;
    const faceId = faceMap?.[e.faceIndex];
    if (faceId === undefined) return;
    const local = meshRef.current!.worldToLocal(e.point.clone());
    let picked: number | null = null;
    if (editMode.mode === 'face') picked = faceId;
    else if (editMode.mode === 'edge') picked = nearestEdgeOfFace(editable, faceId, local);
    else picked = nearestVertexOfFace(editable, faceId, local);
    if (picked === null) return;
    const shift = (e as { shiftKey?: boolean }).shiftKey ?? (e.nativeEvent as MouseEvent | undefined)?.shiftKey;
    if (shift) {
      const cur = new Set(editMode.selection);
      if (cur.has(picked)) cur.delete(picked);
      else cur.add(picked);
      setEditSelection([...cur]);
    } else {
      setEditSelection([picked]);
    }
  };

  return (
    <group
      ref={registerNode(`mesh:${mesh.id}`)}
      position={[p.x, p.y, p.z]}
      rotation={[r.x * DEG, r.y * DEG, r.z * DEG]}
      scale={[sc.x, sc.y, sc.z]}
    >
      <mesh ref={meshRef} geometry={geometry} onClick={onClick}>
        <meshStandardMaterial
          color={texture ? '#ffffff' : mesh.color}
          map={texture}
          emissive={selected && !editMode ? '#335533' : '#000000'}
          roughness={0.8}
          transparent={editingOther}
          opacity={editingOther ? 0.3 : 1}
        />
      </mesh>
      {editingThis && <EditModeOverlay mesh={mesh} renderedMesh={meshRef} />}
    </group>
  );
}

function ObjectEntity({ object }: { object: StageObject }) {
  const select = useEditor((s) => s.select);
  const selected = useEditor((s) => s.selection?.kind === 'object' && s.selection.id === object.id);
  const { position: p, rotation: r } = object;
  return (
    <group
      ref={registerNode(`object:${object.id}`)}
      position={[p.x, p.y, p.z]}
      rotation={[r.x * DEG, r.y * DEG, r.z * DEG]}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'object', id: object.id });
      }}
    >
      <ObjectVisual object={object} selected={selected} />
    </group>
  );
}

function StartEntity() {
  const select = useEditor((s) => s.select);
  const selected = useEditor((s) => s.selection?.kind === 'start');
  const start = useEditor((s) => s.doc.start);
  return (
    <group
      ref={registerNode('start')}
      position={[start.position.x, start.position.y, start.position.z]}
      rotation={[start.rotation.x * DEG, start.rotation.y * DEG, start.rotation.z * DEG]}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'start' });
      }}
    >
      <StartVisual selected={selected} />
    </group>
  );
}

function FalloutPlane() {
  const falloutY = useEditor((s) => s.doc.falloutY);
  return (
    <mesh position={[0, falloutY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#7f1d1d" opacity={0.25} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Attaches the transform gizmo to whichever node is selected. */
function SelectionGizmo() {
  const selection = useEditor((s) => s.selection);
  const editMode = useEditor((s) => s.editMode);
  const mode = useEditor((s) => s.transformMode);
  const snap = useEditor((s) => s.snapEnabled);
  const captureSnapshot = useEditor((s) => s.captureSnapshot);
  const mutate = useEditor((s) => s.mutate);
  const setDragReadout = useEditor((s) => s.setDragReadout);
  const dragging = useRef(false);

  const key = selectionKey(selection);
  const node = key ? nodeRegistry.get(key) : undefined;
  if (!selection || !node || editMode) return null;

  const publishReadout = () => {
    if (mode === 'rotate') {
      setDragReadout({ mode, values: [node.rotation.x / DEG, node.rotation.y / DEG, node.rotation.z / DEG] });
    } else if (mode === 'scale') {
      setDragReadout({ mode, values: [node.scale.x, node.scale.y, node.scale.z] });
    } else {
      setDragReadout({ mode, values: [node.position.x, node.position.y, node.position.z] });
    }
  };

  // Scale applies to meshes and objects that carry a scale field
  const supportsScale =
    selection.kind === 'mesh' ||
    (selection.kind === 'object' && true);
  const effectiveMode = mode === 'scale' && !supportsScale ? 'translate' : mode;

  const commit = () => {
    const pos = node.position;
    const rot = node.rotation;
    const scl = node.scale;
    mutate(
      (doc) => {
        const write = (t: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } }) => {
          t.position = { x: pos.x, y: pos.y, z: pos.z };
          t.rotation = { x: rot.x / DEG, y: rot.y / DEG, z: rot.z / DEG };
        };
        if (selection.kind === 'mesh') {
          const m = doc.meshes.find((m) => m.id === selection.id);
          if (m) {
            write(m.transform);
            m.transform.scale = { x: scl.x, y: scl.y, z: scl.z };
          }
        } else if (selection.kind === 'object') {
          const o = doc.objects.find((o) => o.id === selection.id);
          if (o) {
            write(o);
            if ('scale' in o) o.scale = { x: scl.x, y: scl.y, z: scl.z };
            else node.scale.set(1, 1, 1);
          }
        } else {
          write(doc.start);
          node.scale.set(1, 1, 1);
        }
      },
      { captureHistory: false },
    );
  };

  return (
    <TransformControls
      object={node}
      mode={effectiveMode}
      translationSnap={snap ? 0.25 : null}
      rotationSnap={snap ? 15 * DEG : null}
      scaleSnap={snap ? 0.25 : null}
      onMouseDown={() => {
        dragging.current = true;
        captureSnapshot();
        publishReadout();
      }}
      onObjectChange={publishReadout}
      onMouseUp={() => {
        if (dragging.current) {
          dragging.current = false;
          commit();
          setDragReadout(null);
        }
      }}
    />
  );
}

/**
 * Wraps an item group's contents so the animation preview can move them.
 * Outer node: pivot + animated offset; inner node: -pivot. When idle it's an
 * identity wrapper, so gizmo edits on children stay in stage space.
 */
function ItemGroupNode({ group, children }: { group: ItemGroup; children: React.ReactNode }) {
  const outer = useRef<THREE.Group>(null);
  const playing = useEditor((s) => s.previewPlaying);
  const c = group.rotationCenter;

  useFrame(() => {
    if (!outer.current) return;
    const anim = group.animation;
    if (anim && (playing || previewClock.time > 0)) {
      const pose = evalGroupAnimation(anim, previewClock.time);
      outer.current.position.set(c.x + pose.posX, c.y + pose.posY, c.z + pose.posZ);
      outer.current.rotation.set(deg(pose.rotX), deg(pose.rotY), deg(pose.rotZ));
    } else {
      outer.current.position.set(c.x, c.y, c.z);
      outer.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={outer} position={[c.x, c.y, c.z]}>
      <group position={[-c.x, -c.y, -c.z]}>{children}</group>
    </group>
  );
}

const deg = (d: number) => d * DEG;

/** Frames the selected node when the F key bumps focusRequest. */
function FocusHandler() {
  const focusRequest = useEditor((s) => s.focusRequest);
  const { camera, controls } = useThree();
  useEffect(() => {
    if (focusRequest === 0) return;
    const sel = useEditor.getState().selection;
    const key = selectionKey(sel);
    const node = key ? nodeRegistry.get(key) : undefined;
    if (!node) return;
    const box = new THREE.Box3().setFromObject(node);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1);
    const orbit = controls as OrbitControlsImpl | null;
    // pull the camera along its current direction to a distance that frames the box
    const dir = camera.position.clone().sub(orbit?.target ?? center).normalize();
    const dist = radius * 3;
    camera.position.copy(center).addScaledVector(dir, dist);
    if (orbit) {
      orbit.target.copy(center);
      orbit.update();
    }
  }, [focusRequest, camera, controls]);
  return null;
}

/** Themed vertical sky gradient driven by the stage's background selection. */
function SkyBackground() {
  const { scene } = useThree();
  const background = useEditor((s) => s.doc.background);
  const texture = useMemo(() => {
    const theme = getBackgroundSky(background);
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, theme.sky[0]);
    grad.addColorStop(0.55, theme.sky[1]);
    grad.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    // starfield for the darker themes
    if (background === 'night' || background === 'space') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 4, Math.random() * 150, 1, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [background]);
  useEffect(() => {
    const prev = scene.background;
    scene.background = texture;
    return () => {
      scene.background = prev;
      texture.dispose();
    };
  }, [scene, texture]);
  return null;
}

/** Advances the shared preview clock once per frame while playing. */
function ClockDriver() {
  const playing = useEditor((s) => s.previewPlaying);
  useFrame((_, delta) => {
    if (playing) previewClock.time += delta;
  });
  return null;
}

export function Viewport() {
  const doc = useEditor((s) => s.doc);
  return (
    <Canvas
      gl={{ preserveDrawingBuffer: true }}
      onPointerMissed={() => {
        const s = useEditor.getState();
        if (s.editMode) s.setEditSelection([]);
        else s.select(null);
      }}
      style={{ background: '#3ba7e5' }}
    >
      <SkyBackground />
      <hemisphereLight args={['#dff2ff', '#3a5a3a', 0.6]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 20, 10]} intensity={1.3} castShadow />
      <directionalLight position={[-8, 12, -6]} intensity={0.4} />
      <Grid
        infiniteGrid
        cellSize={1}
        sectionSize={10}
        cellColor={getBackgroundSky(doc.background).ground}
        sectionColor="#9fc6e8"
        fadeDistance={90}
        fadeStrength={1.5}
        position={[0, -0.001, 0]}
      />
      {doc.itemGroups.map((g) => (
        <ItemGroupNode key={g.id} group={g}>
          {doc.meshes
            .filter((m) => m.groupId === g.id)
            .map((m) => (
              <MeshEntity key={m.id} mesh={m} />
            ))}
          {doc.objects
            .filter((o) => o.groupId === g.id)
            .map((o) => (
              <ObjectEntity key={o.id} object={o} />
            ))}
        </ItemGroupNode>
      ))}
      {/* orphans (group deleted) render un-wrapped */}
      {doc.meshes
        .filter((m) => !doc.itemGroups.some((g) => g.id === m.groupId))
        .map((m) => (
          <MeshEntity key={m.id} mesh={m} />
        ))}
      {doc.objects
        .filter((o) => !doc.itemGroups.some((g) => g.id === o.groupId))
        .map((o) => (
          <ObjectEntity key={o.id} object={o} />
        ))}
      <StartEntity />
      <FalloutPlane />
      <SelectionGizmo />
      <FocusHandler />
      <ClockDriver />
      <CameraRig />
    </Canvas>
  );
}
