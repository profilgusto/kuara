/**
 * Stub for Next.js's `server-only` marker package.
 *
 * `server-only` exists to make a build fail if server code is pulled into a
 * client bundle. Vitest has no such boundary, so importing the real module
 * only breaks resolution — aliasing it to this empty module lets us unit-test
 * the pure helpers that live alongside server-only code.
 */
export {};
