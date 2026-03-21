"use client";

/**
 * FiguresContext — client-side figure numbering state.
 *
 * The server pre-extracts all <KImage label="..."> labels in document order
 * and passes them to <FiguresProvider>.
 *
 * Each <KImage> with a label reads its 1-based index from this context and
 * registers its src + caption at mount time.
 *
 * <RefFig label="..." /> reads from this context to render a clickable
 * inline link "Fig. N" with a hover thumbnail popover.
 */

import { createContext, useContext } from "react";

export interface FigureMetadata {
  /** Image source URL, registered by KImage on mount */
  src: string;
  /** Caption text, registered by KImage on mount */
  captionText: string;
}

export interface FiguresContextValue {
  /** Labels in document order — determines "Fig. N" numbering */
  figureOrder: string[];
  /** Returns the 1-based figure number for a label, or -1 if not registered */
  indexOfLabel: (label: string) => number;
  /** Returns the runtime metadata (src, caption) registered by KImage */
  getMetadata: (label: string) => FigureMetadata | undefined;
  /** Called by KImage on mount to register its src and caption text */
  registerMetadata: (label: string, data: FigureMetadata) => void;
}

export const FiguresContext = createContext<FiguresContextValue | null>(null);

/**
 * Hook for components that REQUIRE a FiguresProvider ancestor (throws if absent).
 * Use useContext(FiguresContext) directly for optional/graceful-degradation usage.
 */
export function useFigures(): FiguresContextValue {
  const ctx = useContext(FiguresContext);
  if (!ctx)
    throw new Error(
      "<RefFig> or <KImage label> must be rendered inside <FiguresProvider>",
    );
  return ctx;
}
