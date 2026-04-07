"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ModuleLinkData } from "@/lib/payload-content";

interface ModuleLinksContextValue {
  bySlug: Map<string, ModuleLinkData>;
}

const ModuleLinksContext = createContext<ModuleLinksContextValue>({
  bySlug: new Map(),
});

export function useModuleLinks() {
  return useContext(ModuleLinksContext);
}

export function ModuleLinksProvider({
  modules,
  children,
}: {
  modules: ModuleLinkData[];
  children: ReactNode;
}) {
  const bySlug = useMemo(
    () => new Map(modules.map((m) => [m.slug, m])),
    [modules],
  );

  return (
    <ModuleLinksContext.Provider value={{ bySlug }}>
      {children}
    </ModuleLinksContext.Provider>
  );
}
