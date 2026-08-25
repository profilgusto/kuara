/**
 * test/setup.ts — jsdom gaps the app relies on.
 *
 * Loaded by `vitest.config.ts` for every test file.
 */

/**
 * jsdom ships no `window.matchMedia`. `useViewMode` calls it on mount to force
 * text mode on narrow screens, so any component that renders inside the MDX
 * view — Slide, HideInPresentation, InteractiveBox — throws without it.
 *
 * The stub reports "does not match", i.e. a desktop-width viewport, which is
 * the neutral default: it leaves the component's own mode logic in charge.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
