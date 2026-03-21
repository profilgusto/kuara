"use client";

import { createContext, useContext } from "react";

interface ModuleContextType {
  title: string;
}

export const ModuleContext = createContext<ModuleContextType>({
  title: "",
});

export function useModuleContext() {
  return useContext(ModuleContext);
}
