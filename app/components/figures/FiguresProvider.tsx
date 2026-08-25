"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { FiguresContext, type FigureMetadata } from "./FiguresContext";

interface FiguresProviderProps {
  /** Labels in document order, extracted server-side from MDX source */
  figureOrder: string[];
  children: ReactNode;
}

export function FiguresProvider({
  figureOrder,
  children,
}: FiguresProviderProps) {
  // Runtime metadata (src, captionText) registered by KImage on mount.
  // Using a ref avoids re-renders — metadata is only needed at hover time,
  // after all components have already mounted.
  const metaRef = useRef<Map<string, FigureMetadata>>(new Map());

  const value = useMemo(() => {
    // Build a stable label→index lookup from the SSR-extracted order
    const orderMap = new Map<string, number>();
    figureOrder.forEach((label, i) => orderMap.set(label, i + 1));

    return {
      figureOrder,
      indexOfLabel: (label: string) => orderMap.get(label) ?? -1,
      getMetadata: (label: string) => metaRef.current.get(label),
      registerMetadata: (label: string, data: FigureMetadata) => {
        metaRef.current.set(label, data);
      },
    };
  }, [figureOrder]);

  return (
    <FiguresContext.Provider value={value}>{children}</FiguresContext.Provider>
  );
}
