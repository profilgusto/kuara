/**
 * The geometry of the `position-vector` widget, in pure form.
 *
 * The dimension vocabulary it shares with every other switchable widget comes
 * from `../../dimensions` and is re-exported here, so the component and the
 * print fallback have one import for their geometry. What this module adds is
 * what makes this widget different from `coord-frame-3d`: the student moves
 * the point over a ±5 world, so the grid, the cameras and the arrow
 * proportions are all sized for a scene an order of magnitude larger than the
 * unit triedro — while the basis arrows stay exactly one unit long, because
 * that is the yardstick the coordinates are read against.
 *
 * No three.js and no React here: every number the scene depends on is then
 * checkable in Phase 1.
 */
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import {
  AXIS_UNIT,
  offsetAlong,
  rangeTicks,
  visibleAxes,
  type AxisKey,
  type Dimension,
} from "../../dimensions";

export {
  DIMENSIONS,
  clampPoint,
  interactionHint,
  referenceKind,
  rollUp,
  rotationMode,
  shortestAngleDelta,
  showsProjections,
  toDimension,
  visibleAxes,
  type AxisKey,
  type Dimension,
} from "../../dimensions";

/**
 * How far each coordinate may be driven, in both directions — the slider's
 * limit and the grid's reach are the same number on purpose: a point the
 * student can dial past the edge of the graduation is a point they can no
 * longer read off anything.
 */
export const RANGE = 5;

/** One grid square, one ruler graduation, one basis vector. */
export const GRID_STEP = 1;
export const GRID_SIZE = 2 * RANGE;
export const GRID_DIVISIONS = GRID_SIZE / GRID_STEP;

/**
 * The basis arrows are one unit long — they *are* x̂, ŷ, ẑ. Against a grid
 * ten squares wide they look small, and that is the point: the position
 * vector the student is dialling is a sum of five-ish of them.
 */
export const AXIS_LENGTH = 1;

/** Graduation of the 1D ruler, and of the 2D/3D plane: every unit. */
export function gridTicks(): number[] {
  return rangeTicks(RANGE, GRID_STEP);
}

/** Slider bounds, mirrored so the origin sits at the middle of the track. */
export const SLIDER_MIN = -RANGE;
export const SLIDER_MAX = RANGE;

/**
 * Keep a coordinate inside the graduated world.
 *
 * The slider cannot leave it, but an authored `point` can: `vec3` parses
 * "9,0,0" happily, and drawing it would put the marker outside the grid with
 * a slider that could never bring it back.
 */
export function clampToRange(value: number): number {
  // NaN is not a position — it would poison the arrow's direction and blank
  // the scene — so it reads as the origin. An infinity has a side, and clamps
  // to that end of the track like any other out-of-range number.
  if (Number.isNaN(value)) return 0;
  return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value));
}

export function clampVector(point: Vec3): Vec3 {
  return [
    clampToRange(point[0]),
    clampToRange(point[1]),
    clampToRange(point[2]),
  ];
}

/** Which sliders the panel shows: one per coordinate the view actually has. */
export function sliderAxes(dim: Dimension): AxisKey[] {
  return visibleAxes(dim);
}

/**
 * The flat views stand far enough back to hold the whole ±5 graduation; the
 * 3D one trades that coverage for a close, readable frame — see its own note
 * below.
 *
 * As in `coord-frame-3d`, the flat views look straight down an axis rather
 * than at a foreshortened scene, and the 2D view takes +y as up because
 * looking along -z with +z up is degenerate.
 */
export const VIEW_CAMERA: Record<Dimension, Camera> = {
  "1d": {
    position: [0, -15, 0],
    target: [0, 0, 0],
    up: [0, 0, 1],
    fov: 40,
  },
  "2d": {
    position: [0, 0, 17],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fov: 40,
  },
  // The 3D view is the exception to the paragraph above, deliberately: it
  // opens close in, six units out — the nearest `MIN_DISTANCE` allows — with
  // the frame and the vector filling the stage instead of the whole ±5 grid.
  // A view that holds the entire graduation renders the basis arrows, the
  // thing the coordinates are actually read against, barely longer than their
  // own labels. The cost is that the far corners of the dial-able world start
  // off-stage; the student scrolls out to meet them, which is the gesture the
  // hint already names.
  "3d": {
    position: [1.73, -4.63, 4.81],
    // Aimed above the plane rather than at the origin: half of what the
    // student can dial lies above the grid, so centring on it wasted the top
    // of the stage and crowded the ẑ label against the ceiling.
    target: [0, 0, 1.4],
    up: [0, 0, 1],
    fov: 40,
  },
};

/** How near and far the student may zoom, per view. */
export const MIN_DISTANCE = 6;
export const MAX_DISTANCE = 34;

/**
 * Where an axis label sits: past the tip of its one-unit arrow, pushed out far
 * enough to clear the grid line it runs along. The 1D view hangs x̂ below the
 * ruler, leaving the space above it for the point and its label.
 */
export function axisLabelAnchor(
  axis: AxisKey,
  dim: Dimension,
  offset = 0.42,
): Vec3 {
  if (dim === "1d") return [AXIS_LENGTH, 0, -(offset + 0.12)];
  const u = AXIS_UNIT[axis];
  const d = AXIS_LENGTH + offset;
  return [u[0] * d, u[1] * d, u[2] * d];
}

/** Where the point's label sits: clear of the sphere, along screen-up. */
export function labelAnchor(point: Vec3, dim: Dimension, distance = 0.5): Vec3 {
  return offsetAlong(point, VIEW_CAMERA[dim].up, distance);
}

/** Squared length, for the "is this vector worth drawing" test below. */
function lengthOf(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/**
 * A vector shorter than this is treated as no vector at all: its direction is
 * numerically meaningless, and an arrowhead longer than its own shaft draws as
 * a cone sticking out the wrong side of the origin.
 */
const MIN_DRAWN_LENGTH = 1e-3;

export function isDrawableVector(point: Vec3): boolean {
  return lengthOf(point) > MIN_DRAWN_LENGTH;
}

export type Quaternion = [number, number, number, number];

const IDENTITY: Quaternion = [0, 0, 0, 1];

/**
 * The rotation that aims a +Y-oriented cylinder/cone (three.js builds both
 * that way) along `direction`.
 *
 * The basis arrows can use fixed Euler angles because they only ever point
 * three ways; the position vector points anywhere the sliders put it, so it
 * needs the general shortest-arc rotation from +Y. Returned as a raw
 * `[x, y, z, w]` tuple — a `<group quaternion={…}>` takes exactly that, and
 * keeping three.js out of this module keeps the maths testable.
 */
export function arrowQuaternion(direction: Vec3): Quaternion {
  const len = lengthOf(direction);
  // No direction to align to: leave the primitive as it was built.
  if (len === 0) return IDENTITY;

  const [vx, vy, vz] = [
    direction[0] / len,
    direction[1] / len,
    direction[2] / len,
  ];

  // Already along +Y: no rotation to make, and returning the general form
  // here would hand three.js a tuple carrying a -0 component.
  if (vy > 1 - 1e-9) return IDENTITY;

  // Antiparallel to +Y: the shortest arc is undefined (every half-turn about
  // a horizontal axis works), and the general formula below collapses to the
  // zero quaternion. Pick the half-turn about +x.
  if (vy < -1 + 1e-9) return [1, 0, 0, 0];

  // Shortest arc from +Y: axis = ŷ × v, angle folded into w = 1 + ŷ·v.
  const q: Quaternion = [vz, 0, -vx, 1 + vy];
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/**
 * A coordinate as the readout writes it: whole numbers stay whole, and
 * anything else gets exactly one decimal, so the column does not jitter in
 * width as the student drags a slider.
 */
export function formatComponent(value: number): string {
  const v = Object.is(value, -0) ? 0 : value;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** The coordinates of the vector, in the order the view has them. */
export function vectorComponents(point: Vec3, dim: Dimension): string[] {
  return sliderAxes(dim).map((_, i) => formatComponent(point[i]));
}

/**
 * The vector as the section's prose writes it, e.g.
 * `3 x̂ + 2 ŷ + 1 ẑ` — the expansion in (1), with the student's numbers in it.
 *
 * Terms whose coordinate is zero are kept rather than dropped: the point of
 * the line is that the vector *is* a combination of every basis vector of the
 * frame, and a term winking out of existence at 0 teaches the opposite.
 */
export function basisExpansion(point: Vec3, dim: Dimension): string[] {
  return sliderAxes(dim).map(
    (axis, i) => `${formatComponent(point[i])}\u2009${axis}\u0302`,
  );
}
