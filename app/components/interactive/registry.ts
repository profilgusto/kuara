"use client";
/**
 * components/interactive/registry.ts
 *
 * Pairs each catalogue entry with its React implementation.
 *
 * Every widget is wrapped in `next/dynamic` with `ssr: false`, which is what
 * makes this framework cheap: the registry module itself is a few hundred
 * bytes, and a widget's chunk (three.js and friends) is only requested by the
 * pages that actually render it. `ssr: false` is also a hard requirement for
 * anything touching WebGL or `window` — the same reason `PDF.tsx` uses it.
 *
 * `dynamic()` is evaluated at module scope on purpose. Calling it during
 * render would build a new component type on every pass and remount the
 * widget, throwing away the student's camera position on each re-render.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { catalog, type WidgetMeta } from "./catalog";
import WidgetLoading from "./WidgetLoading";
import { getPreview } from "./previews";

interface Implementation {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>;
  /**
   * Optional vector drawing used in place of the widget when printing.
   * Imported statically, not lazily: printing is synchronous, so a chunk still
   * in flight would print as a blank gap. These are plain SVG — cheap enough
   * to carry eagerly, unlike the widgets themselves.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PrintFallback?: ComponentType<any>;
}

const implementations: Record<string, Implementation> = {
  "coord-frame-3d": {
    Component: dynamic(() => import("./widgets/coord-frame-3d"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("coord-frame-3d"),
  },
  "position-vector": {
    Component: dynamic(() => import("./widgets/position-vector"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("position-vector"),
  },
  "rotation-matrix": {
    Component: dynamic(() => import("./widgets/rotation-matrix"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("rotation-matrix"),
  },
  "homogeneous-transform": {
    Component: dynamic(() => import("./widgets/homogeneous-transform"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("homogeneous-transform"),
  },
  "differential-drive": {
    Component: dynamic(() => import("./widgets/differential-drive"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("differential-drive"),
  },
  "inertial-odometry": {
    Component: dynamic(() => import("./widgets/inertial-odometry"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("inertial-odometry"),
  },
  "differential-kinematics": {
    Component: dynamic(() => import("./widgets/differential-kinematics"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("differential-kinematics"),
  },
  "frame-mapping": {
    Component: dynamic(() => import("./widgets/frame-mapping"), {
      ssr: false,
      loading: WidgetLoading,
    }),
    PrintFallback: getPreview("frame-mapping"),
  },
};

export interface WidgetEntry {
  meta: WidgetMeta;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PrintFallback?: ComponentType<any>;
}

/** `null` for an unknown id — the box turns that into author-facing feedback. */
export function getWidget(id: string | undefined): WidgetEntry | null {
  if (!id) return null;
  const meta = catalog[id];
  const impl = implementations[id];
  if (!meta || !impl) return null;
  return { meta, Component: impl.Component, PrintFallback: impl.PrintFallback };
}

/** Ids that are both catalogued and implemented. */
export function implementedIds(): string[] {
  return Object.keys(implementations)
    .filter((id) => id in catalog)
    .sort();
}
