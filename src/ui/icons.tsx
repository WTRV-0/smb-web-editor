import type { JSX, SVGProps } from 'react';

/**
 * Original monoline icon set for the editor — geometric line art drawn in
 * house (not derived from any game asset). Icons inherit `currentColor` so
 * callers control tint via CSS. 24×24 grid, 1.7px stroke.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function Svg({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------------- Geometry ---------------- */

export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 21 7.5 12 12 3 7.5Z" />
    <path d="M3 7.5V16.5L12 21V12" />
    <path d="M21 7.5V16.5L12 21" />
  </Svg>
);

export const RampIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 18 18 18 18 8Z" />
    <path d="M18 18 21 16 21 6 18 8" />
    <path d="M18 8 21 6" />
  </Svg>
);

export const CylinderIcon = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6" rx="7" ry="2.6" />
    <path d="M5 6v12" />
    <path d="M19 6v12" />
    <path d="M5 18a7 2.6 0 0 0 14 0" />
  </Svg>
);

export const WedgeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 18 10 7 15 18Z" />
    <path d="M15 18 20 15 15 7" />
    <path d="M10 7 15 7" opacity="0" />
    <path d="M10 7 14.5 5" />
  </Svg>
);

export const ArcRampIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 17A9 9 0 0 1 20 17" />
    <path d="M7 19A6.5 6.5 0 0 1 17 19" />
    <path d="M4 17 7 19" />
    <path d="M20 17 17 19" />
  </Svg>
);

export const StairsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19h4v-4h4v-4h4v-4h4" />
    <path d="M4 19v-4" opacity="0" />
  </Svg>
);

export const TubeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 6v7a7 7 0 0 0 14 0V6" />
    <path d="M8.5 6v7a3.5 3.5 0 0 0 7 0V6" />
  </Svg>
);

export const FunnelIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16l-6 8v5h-4v-5Z" />
  </Svg>
);

export const ConeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 19 17a7 3 0 0 1-14 0Z" />
    <path d="M5 17a7 3 0 0 0 14 0" />
  </Svg>
);

export const TorusIcon = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="9" ry="5" />
    <ellipse cx="12" cy="12" rx="3.4" ry="1.7" />
  </Svg>
);

export const ImportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v9" />
    <path d="M8 10 12 14 16 10" />
    <path d="M4 16v3h16v-3" />
  </Svg>
);

/* ---------------- Objects ---------------- */

export const GoalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 20V6h12v14" />
    <path d="M6 13h12" />
    <circle cx="12" cy="9.5" r="2.3" />
  </Svg>
);

export const BananaIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 6A10 10 0 0 0 17 17.5" />
    <path d="M6.5 6A6 6 0 0 1 17 17.5" />
    <path d="M6.5 6 6 4.3" />
  </Svg>
);

export const BunchIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8A6 6 0 0 0 12.5 15.5" />
    <path d="M10 7A6 6 0 0 0 15.5 14.5" />
    <path d="M13 8A5 5 0 0 0 17.5 15" />
    <path d="M8 6 15 6" />
  </Svg>
);

export const BumperIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M12 4.5v2.4M12 17.1v2.4M4.5 12h2.4M17.1 12h2.4" />
  </Svg>
);

export const JamabarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="9" width="17" height="6" rx="3" />
    <path d="M9 9v6M15 9v6" />
  </Svg>
);

export const ColliderIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" strokeDasharray="2.6 2.8" />
    <ellipse cx="12" cy="12" rx="8" ry="3.1" strokeDasharray="2.6 2.8" />
  </Svg>
);

export const WormholeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="2" />
  </Svg>
);

export const SwitchIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="6" width="15" height="12" rx="4" />
    <circle cx="12" cy="12" r="3.2" />
  </Svg>
);

/* ---------------- UI glyphs ---------------- */

export const KeyboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 13.5h9" />
  </Svg>
);

export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.5 2.2-2.5 4" />
    <path d="M12 17.2h.01" />
  </Svg>
);

export const GamepadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 9h8a5 5 0 0 1 4.8 6.3l-.3 1a2.4 2.4 0 0 1-4.4.5L15 15H9l-1.1 1.8a2.4 2.4 0 0 1-4.4-.5l-.3-1A5 5 0 0 1 8 9Z" />
    <path d="M6.5 12.5v2M5.5 13.5h2" />
    <path d="M16 12.5h.01M17.5 14h.01" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20v-3.5L15 5.5 18.5 9 7.5 20Z" />
    <path d="M13 7.5 16 10.5" />
  </Svg>
);

export const BoxSelectIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="13" rx="1.5" strokeDasharray="3 2.6" />
  </Svg>
);

/**
 * Brand mark: a transparent ball with a simple monkey face inside. Original
 * artwork. `filled` gives the wordmark a solid colored ball; otherwise it's a
 * line glyph that inherits currentColor.
 */
export function BrandMark({ size = 26, filled = false, ...rest }: IconProps & { filled?: boolean }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" {...rest}>
      {/* ball */}
      <circle
        cx="16"
        cy="16"
        r="13"
        fill={filled ? 'var(--accent)' : 'none'}
        stroke={filled ? 'var(--accent-ink)' : 'currentColor'}
        strokeWidth="1.6"
      />
      {/* glossy highlight */}
      {filled && <path d="M9 10a9 9 0 0 1 6-3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />}
      <g stroke={filled ? 'var(--accent-ink)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* ears */}
        <circle cx="9.5" cy="12.5" r="2.4" fill={filled ? 'var(--accent)' : 'none'} />
        <circle cx="22.5" cy="12.5" r="2.4" fill={filled ? 'var(--accent)' : 'none'} />
        {/* face */}
        <path d="M11 13a5.4 5.4 0 0 1 10 0c0 4-2.5 6.5-5 6.5S11 17 11 13Z" fill={filled ? '#fff5d6' : 'none'} />
        {/* eyes + muzzle */}
        <circle cx="14" cy="14.5" r="0.8" fill={filled ? 'var(--accent-ink)' : 'currentColor'} stroke="none" />
        <circle cx="18" cy="14.5" r="0.8" fill={filled ? 'var(--accent-ink)' : 'currentColor'} stroke="none" />
        <path d="M14.5 17.5a2 2 0 0 0 3 0" />
      </g>
    </svg>
  );
}
