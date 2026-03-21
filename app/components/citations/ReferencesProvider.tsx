"use client";

import { useMemo, type ReactNode } from "react";
import { ReferencesContext } from "./ReferencesContext";
import type { ReferenceData, CitationStyle } from "@/lib/citation-shared";

interface ReferencesProviderProps {
  references: ReferenceData[];
  citationOrder: string[];
  style: CitationStyle;
  children: ReactNode;
}

export function ReferencesProvider({
  references,
  citationOrder,
  style,
  children,
}: ReferencesProviderProps) {
  const value = useMemo(() => {
    const byKey = new Map<string, ReferenceData>();
    for (const ref of references) byKey.set(ref.key, ref);

    return {
      byKey,
      citationOrder,
      style,
      indexOfKey: (key: string) => {
        const idx = citationOrder.indexOf(key);
        return idx === -1 ? -1 : idx + 1; // 1-based
      },
    };
  }, [references, citationOrder, style]);

  return (
    <ReferencesContext.Provider value={value}>
      {children}
    </ReferencesContext.Provider>
  );
}
