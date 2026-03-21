"use client";
import { useEffect, useLayoutEffect, useContext, type ReactNode } from "react";
import { useViewMode } from "./useViewMode";
import { SlideSecondColumnContext } from "./SlideSecondColumnContext";

// useLayoutEffect runs synchronously before browser paint, preventing a
// single-column flash when switching to presentation mode. The server-safe
// fallback to useEffect avoids SSR warnings in Next.js.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * SlideSecondColumnContent
 *
 * In presentation mode, registers its children into the parent Slide's state
 * via SlideSecondColumnContext, causing the slide to switch to a two-column
 * layout. The component itself renders nothing in presentation mode.
 *
 * In text mode, renders children inline unless textModeVisible is false.
 *
 * Props:
 *   width            – right column width in presentation mode (default "50%")
 *   textModeVisible  – whether to render in text mode (default true)
 */
export default function SlideSecondColumnContent({
  children,
  width = "50%",
  textModeVisible = true,
}: {
  children: ReactNode;
  width?: string;
  textModeVisible?: boolean | string;
}) {
  const mode = useViewMode();
  const ctx = useContext(SlideSecondColumnContext);

  // Register / deregister with the parent Slide.
  // Deps: [mode] only — children content is static MDX so we intentionally
  // skip it to avoid an infinite re-render loop (React elements are new
  // objects each render even when content is identical).
  useIsomorphicLayoutEffect(() => {
    if (mode === "apresentacao" && ctx) {
      ctx.register(children, width);
      return () => ctx.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ctx]);

  if (mode === "apresentacao") return null;

  const isVisible = textModeVisible !== false && textModeVisible !== "false";
  return isVisible ? <>{children}</> : null;
}
