import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEditor, type CameraView } from '../state/store';

const HOME_OFFSET = new THREE.Vector3(12, 10, 14);
const AXIS: Record<Exclude<CameraView, 'home'>, THREE.Vector3> = {
  top: new THREE.Vector3(0, 1, 0),
  front: new THREE.Vector3(0, 0, 1),
  side: new THREE.Vector3(1, 0, 0),
};

/**
 * Owns the scene camera (perspective ↔ orthographic) and applies snap views.
 * OrbitControls is keyed on projection so it re-binds to the active camera.
 * The view is re-applied whenever the active camera identity changes, so a
 * projection swap (which mounts a fresh camera) doesn't lose the framing.
 */
export function CameraRig() {
  const projection = useEditor((s) => s.projection);
  const viewNonce = useEditor((s) => s.viewNonce);
  const boxSelectActive = useEditor((s) => s.boxSelectActive);
  const { camera, controls, size } = useThree();
  const appliedKey = useRef('');

  useEffect(() => {
    const view = useEditor.getState().requestedView;
    if (!view) return;
    const key = `${viewNonce}:${camera.uuid}`;
    if (key === appliedKey.current) return;
    appliedKey.current = key;

    const orbit = controls as OrbitControlsImpl | null;
    const target = orbit?.target ?? new THREE.Vector3();

    if (view === 'home') {
      camera.up.set(0, 1, 0);
      camera.position.copy(target).add(HOME_OFFSET);
    } else {
      camera.up.set(0, view === 'top' ? 0 : 1, view === 'top' ? -1 : 0);
      camera.position.copy(target).addScaledVector(AXIS[view], 100);
      if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = size.height / 40; // frame ~40 world units of height
        camera.updateProjectionMatrix();
      }
    }
    camera.lookAt(target);
    orbit?.update();
  }, [viewNonce, camera, controls, size.height, projection]);

  return (
    <>
      {projection === 'perspective' ? (
        <PerspectiveCamera makeDefault position={[12, 10, 14]} fov={50} near={0.1} far={2000} />
      ) : (
        <OrthographicCamera makeDefault position={[12, 10, 14]} zoom={22} near={-1000} far={2000} />
      )}
      {/* disable orbit while box-selecting so left-drag draws the rectangle */}
      <OrbitControls key={projection} makeDefault enabled={!boxSelectActive} />
    </>
  );
}
