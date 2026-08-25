/**
 * The `rotation-matrix` widget's scene: where its camera stands, how far its
 * grid reaches, how long its arrows are.
 *
 * The mathematics itself — the elementary rotations, the order they compose
 * in, and what "own axis" versus "inertial axis" means for that order — lives
 * in `components/interactive/rotations.ts`, shared with every other widget
 * that has an orientation, and is re-exported here so this widget's component,
 * print fallback and tests all read it through one door.
 *
 * No three.js and no React, so the geometry stays verifiable in Phase 1.
 */
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import type { AxisKey } from "../../dimensions";

export {
  ANGLE_AXES,
  ANGLE_MAX,
  ANGLE_MIN,
  ANGLE_SYMBOLS,
  ROTATION_MODES,
  apply,
  clampAngle,
  clampAngles,
  column,
  elementary,
  factorOrder,
  formatEntry,
  formatMatrix,
  identity,
  matrixToQuaternion,
  multiply,
  rotationMatrix,
  toRotationMode,
  type AxisKey,
  type Mat3,
  type Quaternion,
  type RotationMode,
} from "../../rotations";

// ─── the scene ────────────────────────────────────────────────────────────────

/**
 * Both triads are one unit long, because both are made of unit vectors: the
 * figure is about *orientation*, and an {R} drawn longer than {I} would
 * suggest a scaling that a rotation matrix cannot express.
 */
export const AXIS_LENGTH = 1;

/** One grid square is one basis vector, two squares out in each direction. */
export const GRID_STEP = 1;
export const GRID_HALF = 2 * GRID_STEP;
export const GRID_SIZE = 2 * GRID_HALF;
export const GRID_DIVISIONS = GRID_SIZE / GRID_STEP;

/**
 * One camera, since this widget has no dimension switch: a three-quarter view
 * in which none of the three inertial axes is foreshortened into a point, so
 * every column of the matrix stays legible on the drawing.
 */
export const CAMERA: Camera = {
  position: [2.7, -3.0, 2.2],
  target: [0, 0, 0.15],
  up: [0, 0, 1],
  fov: 40,
};

export const MIN_DISTANCE = 2.5;
export const MAX_DISTANCE = 12;

export const AXIS_UNIT: Record<AxisKey, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/** Where an axis label sits: just past the tip of its arrow. */
export function axisLabelAnchor(axis: AxisKey, offset = 0.22): Vec3 {
  const u = AXIS_UNIT[axis];
  const d = AXIS_LENGTH + offset;
  return [u[0] * d, u[1] * d, u[2] * d];
}

/** The hint under the stage. The sliders, not the drag, own the rotation. */
export const INTERACTION_HINT =
  "Arraste para girar a câmera · use os sliders para girar {R}";
