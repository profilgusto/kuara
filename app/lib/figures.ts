/**
 * lib/figures.ts — Figure label extraction for MDX content.
 *
 * Pure utility — no server-only constraint, safe to import anywhere.
 */

/**
 * Scans raw MDX content for <KImage label="..." /> usages.
 * Returns unique labels in document order (first appearance).
 * This mirrors extractCiteLabels and is used to pre-seed FiguresProvider.
 */
export function extractFigureLabels(content: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const re = /<KImage\b[^>]*\blabel="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ordered.push(m[1]);
    }
  }

  return ordered;
}
