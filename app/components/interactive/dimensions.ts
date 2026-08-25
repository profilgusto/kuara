/**
 * components/interactive/dimensions.ts
 *
 * The 1D / 2D / 3D vocabulary shared by every widget whose header carries the
 * dimension switch.
 *
 * A widget's own module keeps what is particular to its scene — how far its
 * grid reaches, where its cameras stand, how its labels are placed. What lives
 * here is the part that must not differ between widgets: which axes a view
 * draws, how a drag is answered in each, and what happens to a 3D point when
 * the student flattens the scene. Two widgets disagreeing about whether "2D"
 * means the xy plane would be a lesson-level bug.
 *
 * Pure — no three.js, no React — so every rule is verifiable in Phase 1.
 */
import type { Vec3 } from "./props";

export type Dimension = "1d" | "2d" | "3d";

export type AxisKey = "x" | "y" | "z";

/** Button order in the header, and the order the axes appear in. */
export const DIMENSIONS: Dimension[] = ["1d", "2d", "3d"];

/**
 * How many coordinates the view has. Callers index axes and coordinate
 * tuples with this, so it is the one place the "1d means x only" rule lives.
 */
export const AXIS_COUNT: Record<Dimension, 1 | 2 | 3> = {
  "1d": 1,
  "2d": 2,
  "3d": 3,
};

const ALL_AXES: AxisKey[] = ["x", "y", "z"];

export const AXIS_UNIT: Record<AxisKey, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * An unknown or absent `variant` reads as the full 3D view: a widget must
 * still draw itself when rendered outside the box — the admin thumbnail, a
 * direct import in a test — where nothing sets the prop.
 */
export function toDimension(variant: string | undefined): Dimension {
  return DIMENSIONS.includes(variant as Dimension)
    ? (variant as Dimension)
    : "3d";
}

export function visibleAxes(dim: Dimension): AxisKey[] {
  return ALL_AXES.slice(0, AXIS_COUNT[dim]);
}

/**
 * How each view answers a drag.
 *
 * The plane does **not** orbit. A 2D frame has one rotation available to it —
 * about the ẑ it would have if it were 3D — so dragging spins the frame in
 * place, camera still square to the plane and both basis vectors always in
 * view. Orbiting it would show the student a rotation the plane cannot have.
 * The 1D line has no rotation at all; the triedro has all of them.
 */
export type RotationMode = "none" | "roll" | "orbit";

export function rotationMode(dim: Dimension): RotationMode {
  if (dim === "1d") return "none";
  return dim === "2d" ? "roll" : "orbit";
}

/** The hint under the stage, naming only the gestures the view answers to. */
export function interactionHint(dim: Dimension): string {
  switch (rotationMode(dim)) {
    case "orbit":
      return "Arraste para girar · role para aproximar";
    case "roll":
      return "Arraste para girar em torno de ẑ · role para aproximar";
    default:
      return "Role para aproximar";
  }
}

/**
 * The camera's up vector for a plane rolled by `angle` radians about ẑ.
 *
 * Rolling the camera rather than turning the scene keeps every object at the
 * world coordinates the print fallback projects from, and keeps the label DOM
 * upright and readable however far the frame has been spun.
 */
export function rollUp(angle: number): Vec3 {
  return [-Math.sin(angle), Math.cos(angle), 0];
}

/**
 * `to - from`, taken the short way round.
 *
 * The drag is tracked as an angle about the centre of the stage, and that
 * angle wraps at ±π. Subtracting naively makes the frame spin a full turn
 * backwards the moment the pointer crosses the seam.
 */
export function shortestAngleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Every view gets a graduated reference: the xy plane in 2D and 3D, and in 1D
 * a ruler along x — a line has no plane to lie on, but it still deserves to
 * be read off something.
 */
export function referenceKind(dim: Dimension): "ruler" | "plane" {
  return dim === "1d" ? "ruler" : "plane";
}

/** Dashed guides to the axes need at least two of them to run between. */
export function showsProjections(dim: Dimension): boolean {
  return dim !== "1d";
}

/**
 * A point is always a 3-tuple; in a lower view its extra coordinates are
 * dropped to zero rather than drawn, so what the student sees stays an honest
 * example of that dimension instead of a 3D point hovering off a plane.
 */
export function clampPoint(point: Vec3, dim: Dimension): Vec3 {
  const n = AXIS_COUNT[dim];
  return [point[0], n >= 2 ? point[1] : 0, n >= 3 ? point[2] : 0];
}

/** The coordinate tuple as written beside a marked point, e.g. `(1.5, 1)`. */
export function formatCoords(point: Vec3, dim: Dimension): string {
  return `(${point.slice(0, AXIS_COUNT[dim]).join(", ")})`;
}

/**
 * Where a graduated reference is ticked: every `step` from one end to the
 * other, origin included. Built from the step rather than listed, so a ruler
 * cannot drift away from the grid it stands in for. Rounded because the
 * accumulating addition otherwise yields keys like `0.30000000000000004`.
 */
export function rangeTicks(half: number, step: number): number[] {
  const ticks: number[] = [];
  if (!(step > 0)) return ticks;
  for (let t = -half; t <= half + 1e-9; t += step) {
    ticks.push(Number(t.toFixed(4)));
  }
  return ticks;
}

/**
 * Where a point's label sits: clear of its marker along whichever way is up
 * *on screen* in this view.
 *
 * Offsetting along +z unconditionally works only where the camera looks
 * across it; in a view that looks straight down z the label would land exactly
 * on the marker, which then eats half the coordinates.
 */
export function offsetAlong(point: Vec3, up: Vec3, distance: number): Vec3 {
  return [
    point[0] + up[0] * distance,
    point[1] + up[1] * distance,
    point[2] + up[2] * distance,
  ];
}
