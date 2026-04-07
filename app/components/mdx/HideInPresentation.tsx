"use client";

import { ReactNode } from "react";
import { useViewMode } from "./useViewMode";

export function HideInPresentation({ children }: { children: ReactNode }) {
  const mode = useViewMode();
  if (mode === "apresentacao") return null;
  return <>{children}</>;
}
