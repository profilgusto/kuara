/**
 * What the three views of `coord-frame-3d` look like: a line, a plane, and the
 * full triedro.
 *
 * The vocabulary the switch is built on — which axes each view has, how it
 * answers a drag, what flattening does to a point — is shared with every other
 * dimension-switching widget and lives in `../../dimensions`; it is re-exported
 * here so this module stays the single import for the widget's own geometry.
 * What is genuinely this widget's own is the scale: unit-length axes, a grid
 * whose square *is* the basis vector, and the cameras aimed at that.
 *
 * Everything is pure — no three.js, no React — so the geometry behind the
 * switch is verifiable in Phase 1, and the live scene and the print fallback
 * can read the same numbers instead of each hard-coding their own.
 */
import type { Vec3 } from "../../props";
import { DEFAULT_CAMERA, type Camera } from "../../projection";
import {
  AXIS_UNIT,
  offsetAlong,
  rangeTicks,
  type AxisKey,
  type Dimension,
} from "../../dimensions";

export {
  AXIS_COUNT,
  DIMENSIONS,
  clampPoint,
  formatCoords,
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
  type RotationMode,
} from "../../dimensions";

/**
 * Length of each basis-vector arrow, in scene units — and, deliberately, the
 * grid step below.
 *
 * It is 1 because the arrows *are* the unit vectors: drawing them any longer
 * makes the reference grid disagree with the coordinates written beside the
 * marked point, which is exactly the confusion a coordinate-system figure
 * exists to prevent. A point authored at 1.5 sits one and a half arrows out.
 */
export const AXIS_LENGTH = 1;

/**
 * One square of the grid — one graduation of the 1D ruler — is one basis
 * vector on a side. Anything else silently redefines what the drawing's unit
 * is, so this is an equality, not a coincidence: `views.test.ts` guards it.
 */
export const GRID_STEP = AXIS_LENGTH;

/** The reference plane and ruler reach this far from the origin, both ways. */
export const GRID_HALF = 2 * GRID_STEP;

/** Full width of the grid, and the number of squares across it. */
export const GRID_SIZE = 2 * GRID_HALF;
export const GRID_DIVISIONS = GRID_SIZE / GRID_STEP;

/** Where the 1D ruler is graduated: every basis vector, origin included. */
export function rulerTicks(): number[] {
  return rangeTicks(GRID_HALF, GRID_STEP);
}

/**
 * Camera per view, aimed at the middle of what that view actually draws.
 *
 * 1D and 2D look straight down an axis so the frame reads as flat rather than
 * as a foreshortened 3D scene; the 2D view swaps `up` to +y because looking
 * along -z with the scene's usual +z up is degenerate.
 */
export const VIEW_CAMERA: Record<Dimension, Camera> = {
  "1d": {
    position: [0, -4.5, 0],
    target: [0, 0, 0],
    up: [0, 0, 1],
    fov: DEFAULT_CAMERA.fov,
  },
  // Aimed at the origin, not at the middle of the axes: the grid is symmetric
  // about it, and off-centring the camera pushed the grid's lower half off the
  // bottom of the stage.
  "2d": {
    position: [0, 0, 6],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fov: DEFAULT_CAMERA.fov,
  },
  "3d": DEFAULT_CAMERA,
};

/**
 * Where an axis label sits: just past its arrow tip.
 *
 * The 1D view is the exception. There the space past the tip belongs to the
 * ruler and to whatever point is marked further along it, so x̂ hangs below
 * the line instead — the marked point's label goes up, the axis label goes
 * down, and neither has to fight the graduation.
 */
export function axisLabelAnchor(
  axis: AxisKey,
  dim: Dimension,
  offset = 0.2,
): Vec3 {
  if (dim === "1d") return [AXIS_LENGTH, 0, -(offset + 0.04)];
  const u = AXIS_UNIT[axis];
  const d = AXIS_LENGTH + offset;
  return [u[0] * d, u[1] * d, u[2] * d];
}

/** Where the marked point's label sits: clear of the sphere, screen-up. */
export function labelAnchor(
  point: Vec3,
  dim: Dimension,
  distance = 0.22,
): Vec3 {
  return offsetAlong(point, VIEW_CAMERA[dim].up, distance);
}
