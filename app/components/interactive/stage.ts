/**
 * components/interactive/stage.ts
 *
 * How tall an interactive block's stage is, per view mode.
 *
 * Pure and separate from the box because the presentation branch emits a CSS
 * `min()`, which jsdom's style engine rejects outright — the value never
 * reaches the DOM under test. Keeping the rule here makes it verifiable in
 * Phase 1 instead of only by eye in a browser.
 */
import type { ViewMode } from "@/components/mdx/useViewMode";

/** Ceiling for a block on a presentation slide, as a share of the viewport. */
export const PRESENTATION_MAX_VH = 48;

export function stageHeight(mode: ViewMode, heightPx: number): string {
  // Slides are viewport-fitted: a box sized for comfortable reading pushes the
  // slide's text off-screen. Cap it, but keep the authored height as the upper
  // bound rather than overriding the author outright.
  return mode === "apresentacao"
    ? `min(${heightPx}px, ${PRESENTATION_MAX_VH}vh)`
    : `${heightPx}px`;
}
