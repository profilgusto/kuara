"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface TesselaLinkData {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  stage?: string;
}

interface TesselaLinksContextValue {
  bySlug: Map<string, TesselaLinkData>;
}

const TesselaLinksContext = createContext<TesselaLinksContextValue>({
  bySlug: new Map(),
});

export function useTesselaLinks() {
  return useContext(TesselaLinksContext);
}

export function TesselaLinksProvider({
  tesselas,
  children,
}: {
  tesselas: TesselaLinkData[];
  children: ReactNode;
}) {
  const bySlug = useMemo(
    () => new Map(tesselas.map((t) => [t.slug, t])),
    [tesselas],
  );

  return (
    <TesselaLinksContext.Provider value={{ bySlug }}>
      {children}
    </TesselaLinksContext.Provider>
  );
}
