/**
 * Mutable animation-preview clock, deliberately outside React/Zustand so the
 * viewport can advance it every frame without re-rendering the UI tree.
 */
export const previewClock = {
  time: 0,
};
