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

/**
 * Node 25+ ships its own global `localStorage` / `sessionStorage`. Without
 * the `--localstorage-file` flag that global is `undefined` — and because it
 * already exists, Vitest's jsdom environment does not replace it with
 * jsdom's. So on those Node versions `localStorage.setItem` throws in any
 * test (and in any component under test) that touches it, while the same
 * suite passes on Node 22, which the Docker image runs.
 *
 * When the global is unusable, point it at jsdom's own Storage — the real
 * implementation, reachable through the `jsdom` handle Vitest exposes — or,
 * failing that, at a minimal in-memory one.
 */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(String(key)) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(String(key)),
    setItem: (key, value) => void items.set(String(key), String(value)),
  };
}

if (typeof window !== "undefined") {
  const jsdomWindow = (
    globalThis as { jsdom?: { window?: Partial<Record<string, Storage>> } }
  ).jsdom?.window;

  for (const name of ["localStorage", "sessionStorage"] as const) {
    let usable = false;
    try {
      usable = typeof globalThis[name]?.setItem === "function";
    } catch {
      // A getter that throws is as unusable as one that returns undefined.
    }
    if (usable) continue;

    let storage: Storage | undefined;
    try {
      storage = jsdomWindow?.[name];
    } catch {
      // jsdom refuses storage on an opaque origin; fall through.
    }
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: typeof storage?.setItem === "function" ? storage : memoryStorage(),
    });
  }
}
