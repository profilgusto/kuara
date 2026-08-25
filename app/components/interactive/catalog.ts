/**
 * components/interactive/catalog.ts
 *
 * The Kuara interactive-widget catalogue: the single, dependency-free list of
 * what an author may put inside `<Interactive widget="…">`.
 *
 * This module holds metadata ONLY. It must stay free of `next/dynamic`, React
 * and any widget implementation, because three consumers import it in
 * environments where those would not resolve:
 *   - `registry.ts`, which pairs each entry with its lazily-loaded component;
 *   - the Vitest suite, which checks every schema without a browser;
 *   - `scripts/gen-interactive-docs.mjs`, which regenerates §9 of the
 *     authoring guide from these descriptions.
 */
import type { PropSchema } from "./props";

/**
 * One entry in a widget's view switcher — the button group the box draws in
 * the header, right of the "interativo" tag.
 *
 * The box owns which one is active and hands the widget its id as `variant`;
 * the widget decides what that means for its scene. Metadata, not behaviour,
 * so the catalogue stays free of React.
 */
export interface WidgetVariant {
  /** Passed to the component (and the print fallback) as `variant`. */
  id: string;
  /** Button text. Two or three characters — the group sits in a tight header. */
  label: string;
  /** Replaces the header title while active, unless the author set `title`. */
  title?: string;
  /** Accessible description of the button, e.g. "Ver em duas dimensões". */
  hint?: string;
}

export interface WidgetMeta {
  /** The `widget="…"` id. Kebab-case, stable — content references it. */
  id: string;
  /** Shown in the box header and in the authoring guide. */
  title: string;
  /** One paragraph for the authoring guide. */
  description: string;
  /** Widget-specific parameters. Box-level ones (height, title…) are separate. */
  props: PropSchema;
  /** Box height in px when the author does not override it. */
  defaultHeight?: number;
  /**
   * Static image shown in place of the widget when printing. Resolved through
   * `resolveMediaUrl`, so an uploaded `/media/…` path works. Without one, the
   * printed page falls back to the title and caption.
   */
  poster?: string;
  /**
   * View switcher shown in the box header. A widget that offers none — the
   * common case — gets no buttons and never sees a `variant` prop.
   */
  variants?: WidgetVariant[];
  /**
   * Which variant starts active. Defaults to the first, so this is only
   * needed when the natural reading order of the buttons (1D, 2D, 3D) is not
   * the view the block should open on.
   */
  defaultVariant?: string;
  /**
   * How the widget is mounted. Only `"component"` exists today; the field is
   * the seam for sandboxed `"iframe"` widgets, so that adding one later does
   * not change a single line of authored content.
   */
  kind?: "component" | "iframe";
}

import coordFrame3d from "./widgets/coord-frame-3d/meta";
import homogeneousTransform from "./widgets/homogeneous-transform/meta";
import positionVector from "./widgets/position-vector/meta";
import rotationMatrix from "./widgets/rotation-matrix/meta";

export const catalog: Record<string, WidgetMeta> = {
  [coordFrame3d.id]: coordFrame3d,
  [positionVector.id]: positionVector,
  [rotationMatrix.id]: rotationMatrix,
  [homogeneousTransform.id]: homogeneousTransform,
};

/**
 * Re-exported so `scripts/gen-interactive-docs.mjs`, which bundles this module
 * as its single entry point, gets the snippet builder alongside the catalogue.
 */
export { mdxSnippet, typeTokens, defaultToken } from "./snippet";

/** Sorted ids — used by the error box to suggest what the author may have meant. */
export function widgetIds(): string[] {
  return Object.keys(catalog).sort();
}
