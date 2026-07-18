// Base path the app is served under in production (e.g. "/kuara"), fixed at
// build time via NEXT_PUBLIC_BASE_PATH. Use this for any manual path
// reference that Next.js's own router doesn't already prefix automatically
// (raw fetch() calls, window.location concatenation, metadata URLs, etc).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function comBasePath(caminho: string): string {
  return `${BASE_PATH}${caminho}`;
}
