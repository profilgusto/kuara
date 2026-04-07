/**
 * lib/tessela-links.ts — Pure utilities for <CiteTessela> cross-references.
 * No server-only imports — safe in both client and server contexts.
 */

/**
 * Scans raw MDX content for <CiteTessela slug="..." /> usages.
 * Returns unique slugs in document order (first appearance).
 */
export function extractCiteTesselaSlugs(content: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const re = /<CiteTessela\b[^>]*\bslug="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ordered.push(m[1]);
    }
  }
  return ordered;
}
