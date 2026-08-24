/**
 * lib/safe-redirect.ts — open-redirect guard for the ?redirect= parameter.
 *
 * Extracted from middleware.ts so it can be unit-tested directly: a Next.js
 * middleware module is expected to export only `middleware` and `config`.
 * Pure and Edge-runtime safe.
 */

/**
 * Ensures the redirect target is a safe relative path.
 * Prevents open-redirect attacks via crafted ?redirect= values.
 */
export function sanitizeRedirect(pathname: string): string {
  // Must start with / but not // (protocol-relative URL)
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/";
  }
  return pathname;
}
