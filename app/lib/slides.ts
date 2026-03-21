/**
 * lib/slides.ts — Slide metadata extraction from MDX content.
 *
 * Pure utility — no server-only constraint, safe to import anywhere.
 */

export interface SlideCoverData {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  backgroundImage?: string;
  logoImage?: string;
}

/**
 * Extracts props from the first <SlideCover> component in raw MDX source.
 * Returns null if no SlideCover directive is found.
 */
export function extractSlideCoverProps(content: string): SlideCoverData | null {
  const match = content.match(/<SlideCover\b([\s\S]*?)(?:\/>|>)/);
  if (!match) return null;

  const attrs = match[1];

  const extract = (name: string): string | undefined => {
    const m = attrs.match(new RegExp(`\\b${name}=["']([^"']*)["']`));
    return m ? m[1] : undefined;
  };

  return {
    title: extract("title"),
    subtitle: extract("subtitle"),
    author: extract("author"),
    date: extract("date"),
    backgroundImage: extract("backgroundImage"),
    logoImage: extract("logoImage"),
  };
}
