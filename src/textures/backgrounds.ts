/**
 * Editor-preview backgrounds. These are original stylized skies used only to
 * give the viewport a sense of theme — they are NOT the game's background art.
 * In-game backgrounds are supplied by the game's own stock background assets
 * (referenced by name at export), not shipped here.
 */

export interface BackgroundTheme {
  id: string;
  name: string;
  /** three vertical gradient stops: top, middle, horizon */
  sky: [string, string, string];
  /** subtle tint applied to the ground/grid, gives a sense of environment */
  ground: string;
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  { id: 'jungle', name: 'Jungle', sky: ['#2f7bb0', '#5cb4dc', '#b7e3b0'], ground: '#3e7d47' },
  { id: 'water', name: 'Water', sky: ['#12507e', '#2f8fc4', '#a7dcf0'], ground: '#2b6f8a' },
  { id: 'sunset', name: 'Sunset', sky: ['#3a2352', '#c85a52', '#f2b46a'], ground: '#7a4b3a' },
  { id: 'night', name: 'Night', sky: ['#070b1a', '#122045', '#2b3a66'], ground: '#1a2340' },
  { id: 'space', name: 'Space', sky: ['#04030c', '#0c0a24', '#1c1740'], ground: '#141234' },
  { id: 'sand', name: 'Sand', sky: ['#4c8fc0', '#a9cfe0', '#e6d29c'], ground: '#c2a566' },
  { id: 'ice', name: 'Ice', sky: ['#5f8fc0', '#bcd8ec', '#e8f4fb'], ground: '#b8d6e6' },
  { id: 'storm', name: 'Storm', sky: ['#2a2f3a', '#495060', '#7c8698'], ground: '#3a4150' },
  { id: 'bonus', name: 'Bonus', sky: ['#5a2a86', '#a85ad0', '#f0c0f0'], ground: '#7a4b9a' },
  { id: 'master', name: 'Master', sky: ['#1a0d10', '#4a1a20', '#8a3a40'], ground: '#40181c' },
];

const DEFAULT = BACKGROUND_THEMES[0];

export function getBackgroundSky(id: string): BackgroundTheme {
  return BACKGROUND_THEMES.find((b) => b.id === id) ?? DEFAULT;
}
