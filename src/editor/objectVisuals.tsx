import type { JSX } from 'react';
import type { StageObject } from '../model/types';

const GOAL_COLORS = { blue: '#3b82f6', green: '#22c55e', red: '#ef4444' } as const;
const SWITCH_COLORS = {
  rewind: '#f97316',
  reverse: '#eab308',
  stop: '#ef4444',
  play: '#22c55e',
  fastForward: '#3b82f6',
} as const;

/**
 * Proxy visuals for gameplay objects. These are editor stand-ins, not the real
 * game models; sizes match in-game footprints so layout reads correctly.
 */
export function ObjectVisual({ object, selected }: { object: StageObject; selected: boolean }): JSX.Element {
  const highlight = selected ? '#ffffff' : undefined;
  switch (object.type) {
    case 'goal': {
      const c = highlight ?? GOAL_COLORS[object.variant];
      return (
        <group>
          {/* posts + crossbar */}
          <mesh position={[-1.1, 1.05, 0]}>
            <boxGeometry args={[0.2, 2.1, 0.2]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[1.1, 1.05, 0]}>
            <boxGeometry args={[0.2, 2.1, 0.2]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[2.4, 0.2, 0.2]} />
            <meshStandardMaterial color={c} />
          </mesh>
          {/* party ball */}
          <mesh position={[0, 1.7, 0]}>
            <sphereGeometry args={[0.35, 16, 12]} />
            <meshStandardMaterial color={c} metalness={0.4} roughness={0.3} />
          </mesh>
          {/* tape */}
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2.2, 0.15, 0.02]} />
            <meshStandardMaterial color="#ffffff" opacity={0.8} transparent />
          </mesh>
        </group>
      );
    }
    case 'banana': {
      const c = highlight ?? '#facc15';
      if (object.variant === 'bunch') {
        return (
          <group>
            {[
              [0, 0.35, 0],
              [-0.25, 0.2, 0.1],
              [0.25, 0.2, 0.1],
              [0, 0.2, -0.22],
            ].map((p, i) => (
              <mesh key={i} position={p as [number, number, number]}>
                <sphereGeometry args={[0.22, 12, 10]} />
                <meshStandardMaterial color={c} />
              </mesh>
            ))}
          </group>
        );
      }
      return (
        <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0.5]}>
          <torusGeometry args={[0.18, 0.09, 8, 12, Math.PI * 1.4]} />
          <meshStandardMaterial color={c} />
        </mesh>
      );
    }
    case 'bumper':
      return (
        <mesh position={[0, 0.25, 0]} scale={[object.scale.x, object.scale.y, object.scale.z]}>
          <cylinderGeometry args={[0.6, 0.7, 0.5, 16]} />
          <meshStandardMaterial color={highlight ?? '#fb923c'} />
        </mesh>
      );
    case 'jamabar':
      return (
        <mesh position={[0, 0.5, 0]} scale={[object.scale.x, object.scale.y, object.scale.z]}>
          <boxGeometry args={[0.4, 1, 2.4]} />
          <meshStandardMaterial color={highlight ?? '#94a3b8'} metalness={0.6} roughness={0.3} />
        </mesh>
      );
    case 'collisionShape': {
      const c = highlight ?? '#c084fc';
      const s: [number, number, number] = [object.scale.x, object.scale.y, object.scale.z];
      return (
        <mesh position={[0, object.shape === 'sphere' ? 0.5 : 0.5, 0]} scale={s}>
          {object.shape === 'sphere' ? (
            <sphereGeometry args={[0.5, 16, 12]} />
          ) : object.shape === 'cylinder' ? (
            <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
          ) : (
            <coneGeometry args={[0.5, 1, 16]} />
          )}
          <meshStandardMaterial color={c} wireframe />
        </mesh>
      );
    }
    case 'wormhole':
      return (
        <group>
          <mesh position={[0, 1, 0]}>
            <torusGeometry args={[0.9, 0.12, 10, 24]} />
            <meshStandardMaterial color={highlight ?? '#38bdf8'} emissive="#0ea5e9" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 1, 0]}>
            <circleGeometry args={[0.85, 24]} />
            <meshStandardMaterial color="#0c4a6e" opacity={0.55} transparent side={2} />
          </mesh>
        </group>
      );
    case 'switch':
      return (
        <group>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.12, 16]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.14, 16]} />
            <meshStandardMaterial color={highlight ?? SWITCH_COLORS[object.kind]} />
          </mesh>
        </group>
      );
  }
}

export function StartVisual({ selected }: { selected: boolean }): JSX.Element {
  const c = selected ? '#ffffff' : '#10b981';
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.5, 20, 16]} />
        <meshStandardMaterial color={c} opacity={0.5} transparent />
      </mesh>
      {/* facing arrow (stages face -z by default) */}
      <mesh position={[0, 0.1, -0.9]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <coneGeometry args={[0.25, 0.7, 4]} />
        <meshStandardMaterial color={c} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.7, 24]} />
        <meshStandardMaterial color={c} side={2} />
      </mesh>
    </group>
  );
}
