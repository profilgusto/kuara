"use client";
import { createContext, type ReactNode } from "react";

export type SlideSecondColumnContextValue = {
  register: (content: ReactNode, width: string) => void;
  clear: () => void;
};

export const SlideSecondColumnContext =
  createContext<SlideSecondColumnContextValue | null>(null);
