/**
 * lib/citations.ts — Server-side citation formatting and Payload fetching.
 *
 * IMPORTANT: This file is server-only (imports citation-js and Payload).
 * It must NEVER be imported from client components.
 */
import "server-only";

export type { CitationStyle, ReferenceData } from "./citation-shared";
export { isNumericStyle, NUMERIC_STYLES } from "./citation-shared";

import type { CitationStyle, ReferenceData } from "./citation-shared";

// ─────────────────────────────────────────────────────────────────────────────
// citation-js plugin bootstrap
// ─────────────────────────────────────────────────────────────────────────────

let pluginsLoaded = false;
async function ensurePlugins() {
  if (pluginsLoaded) return;
  await import("@citation-js/plugin-bibtex");
  await import("@citation-js/plugin-csl");
  pluginsLoaded = true;
}

/** Maps our style names to the CSL template used by @citation-js/plugin-csl */
const CSL_TEMPLATE: Record<CitationStyle, string> = {
  authoryear: "apa",
  apa: "apa",
  chicago: "apa",
  numeric: "vancouver",
  ieee: "vancouver",
  vancouver: "vancouver",
};

// ─────────────────────────────────────────────────────────────────────────────
// BibTeX label extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans raw MDX content for <Cite label="key" /> and
 * <Cite labels={["key1","key2"]} /> usages.
 * Returns unique keys in document order (first appearance).
 */
export function extractCiteLabels(content: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const addKey = (k: string) => {
    if (!seen.has(k)) {
      seen.add(k);
      ordered.push(k);
    }
  };

  // Single label: <Cite label="key" … />
  const singleRe = /<Cite\b[^>]*\blabel="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = singleRe.exec(content)) !== null) addKey(m[1]);

  // Multiple labels: <Cite labels={["key1","key2"]} … />
  const multiRe = /<Cite\b[^>]*\blabels=\{(\[[^\]]+\])\}/g;
  while ((m = multiRe.exec(content)) !== null) {
    try {
      const arr = JSON.parse(m[1].replace(/'/g, '"')) as string[];
      arr.forEach(addKey);
    } catch {
      // malformed — skip
    }
  }

  return ordered;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal CSL data helpers
// ─────────────────────────────────────────────────────────────────────────────

interface CslAuthor {
  family?: string;
  given?: string;
  literal?: string;
}

interface CslData {
  type?: string;
  title?: string;
  author?: CslAuthor[];
  issued?: { "date-parts"?: number[][] };
  DOI?: string;
  URL?: string;
}

function buildAuthoryearInline(data: CslData): string {
  const authors = data.author ?? [];
  const year = data.issued?.["date-parts"]?.[0]?.[0] ?? "?";

  let authorStr: string;
  if (authors.length === 0) {
    authorStr = data.title?.split(" ").slice(0, 3).join(" ") ?? "?";
  } else if (authors.length === 1) {
    authorStr = authors[0].family ?? authors[0].literal ?? "?";
  } else if (authors.length === 2) {
    const a0 = authors[0].family ?? authors[0].literal ?? "?";
    const a1 = authors[1].family ?? authors[1].literal ?? "?";
    authorStr = `${a0} & ${a1}`;
  } else {
    authorStr = `${authors[0].family ?? authors[0].literal ?? "?"} et al.`;
  }

  return `(${authorStr}, ${year})`;
}

function buildDisplayData(data: CslData): {
  title: string;
  authorsDisplay: string;
  year: string;
} {
  const authors = data.author ?? [];
  const year = String(data.issued?.["date-parts"]?.[0]?.[0] ?? "");
  const title = data.title ?? "Untitled";

  let authorsDisplay = "";
  if (authors.length > 0) {
    const shown = authors.slice(0, 5).map((a) => {
      if (a.family && a.given) return `${a.family}, ${a.given.charAt(0)}.`;
      return a.family ?? a.literal ?? "";
    });
    authorsDisplay = shown.join("; ");
    if (authors.length > 5) authorsDisplay += " et al.";
  }

  return { title, authorsDisplay, year };
}

// ─────────────────────────────────────────────────────────────────────────────
// Format a single reference
// ─────────────────────────────────────────────────────────────────────────────

export async function formatReference(opts: {
  key: string;
  bibtex: string;
  style: CitationStyle;
  doi?: string;
  externalUrl?: string;
  coverArtUrl?: string;
}): Promise<ReferenceData> {
  await ensurePlugins();

  const { Cite } = await import("@citation-js/core");

  let cite: InstanceType<typeof Cite>;
  try {
    cite = new Cite(opts.bibtex);
  } catch {
    return {
      key: opts.key,
      inlineAuthoryear: `(${opts.key})`,
      bibliographyHtml: `<span>${opts.key}</span>`,
      title: opts.key,
      authorsDisplay: "",
      year: "",
      doi: opts.doi,
      externalUrl: opts.externalUrl,
      coverArtUrl: opts.coverArtUrl,
    };
  }

  const data = (cite.data[0] ?? {}) as CslData;
  const inlineAuthoryear = buildAuthoryearInline(data);
  const { title, authorsDisplay, year } = buildDisplayData(data);

  const template = CSL_TEMPLATE[opts.style];
  let bibliographyHtml = "";
  try {
    bibliographyHtml = cite.format("bibliography", {
      format: "html",
      template,
      lang: "en-US",
    }) as string;
  } catch {
    bibliographyHtml = `<span>${title} (${year})</span>`;
  }

  return {
    key: opts.key,
    inlineAuthoryear,
    bibliographyHtml,
    title,
    authorsDisplay,
    year,
    doi: opts.doi,
    externalUrl: opts.externalUrl,
    coverArtUrl: opts.coverArtUrl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload fetch + format
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAndFormatReferences(
  keys: string[],
  style: CitationStyle,
  draft = false,
): Promise<ReferenceData[]> {
  if (keys.length === 0) return [];

  const { getPayload } = await import("payload");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configPromise = ((await import("@payload-config")) as any).default;
  const payload = await getPayload({ config: configPromise });

  const result = await payload.find({
    collection: "references" as "media", // cast needed until payload-types regenerates
    where: { key: { in: keys } },
    limit: keys.length,
    draft,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byKey = new Map<string, any>();
  for (const doc of result.docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    byKey.set((doc as any).key as string, doc);
  }

  const formatted: ReferenceData[] = [];
  for (const key of keys) {
    const doc = byKey.get(key);
    if (!doc) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = doc as any;
    const coverArtUrl: string | undefined = d.coverArt?.url ?? undefined;

    const ref = await formatReference({
      key,
      bibtex: d.bibtex ?? "",
      style,
      doi: d.doi ?? undefined,
      externalUrl: d.externalUrl ?? undefined,
      coverArtUrl,
    });
    formatted.push(ref);
  }

  return formatted;
}
