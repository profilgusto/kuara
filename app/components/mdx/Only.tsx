"use client";
import { ReactNode } from "react";
import { useViewMode } from "./useViewMode";

export function PresentOnly({ children }: { children: ReactNode }) {
  const mode = useViewMode();
  if (mode !== "apresentacao") return null;
  return <>{children}</>;
}

export function TextOnly({ children }: { children: ReactNode }) {
  const mode = useViewMode();
  if (mode !== "texto") return null;
  return <>{children}</>;
}
