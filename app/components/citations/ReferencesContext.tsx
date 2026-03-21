"use client";

/**
 * ReferencesContext — client-side citation state.
 *
 * The server pre-fetches all references that appear in the MDX content
 * (in document order) and passes them to <ReferencesProvider>.
 *
 * Each <Cite> component reads from this context to:
 *   - Get its citation data (for the popup)
 *   - Know its numeric index (for [N] styles)
 *
 * <ReferencesSection> reads the ordered list to render the bibliography.
 */

import { createContext, useContext } from "react";
import type { ReferenceData, CitationStyle } from "@/lib/citation-shared";
export { isNumericStyle } from "@/lib/citation-shared";
export type { ReferenceData, CitationStyle };

export interface ReferencesContextValue {
  /** All references available in this module, keyed by cite key */
  byKey: Map<string, ReferenceData>;
  /** Keys in first-appearance order (determines [N] numbering) */
  citationOrder: string[];
  /** Module-level citation style */
  style: CitationStyle;
  /** 1-based index of a key in citationOrder, or -1 if not found */
  indexOfKey: (key: string) => number;
}

export const ReferencesContext = createContext<ReferencesContextValue | null>(
  null,
);

export function useReferences(): ReferencesContextValue {
  const ctx = useContext(ReferencesContext);
  if (!ctx) throw new Error("<Cite> must be used inside <ReferencesProvider>");
  return ctx;
}
