/**
 * The mathematics and the scene of the `homogeneous-transform` widget.
 *
 * The section this widget illustrates defines ᴵT_R as nothing more than a
 * bookkeeping device: the rotation ᴵR_R and the translation ᴵp_R written side
 * by side, with a row of zeros and a one closing the square —
 *
 *     ᴵT_R = ⎡ ᴵR_R   ᴵp_R ⎤ ∈ ℝ⁴ˣ⁴.
 *            ⎣ 0 0 0    1  ⎦
 *
 * So the module owns exactly that: how the two blocks are assembled, how the
 * result acts on a point, and where the frames stand in the scene. The
 * orientation half is imported from `components/interactive/rotations.ts` —
 * the same code the `rotation-matrix` widget teaches from, because ᴵR_R here
 * *is* the ᴵR_R there, and the two figures must never disagree about it.
 *
 * No three.js and no React, so every number is verifiable in Phase 1.
 */
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import {
  formatEntry,
  matrixToQuaternion,
  type AxisKey,
  type Mat3,
  type Quaternion,
} from "../../rotations";

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
  factorOrder,
  formatEntry,
  identity,
  matrixToQuaternion,
  rotationMatrix,
  toRotationMode,
  type AxisKey,
  type Mat3,
  type Quaternion,
  type RotationMode,
} from "../../rotations";

/** A 4×4 matrix as four **rows**, `m[row][col]` — the way the panel reads it. */
export type Mat4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

/**
 * Which block of ᴵT_R an entry belongs to.
 *
 * The panel tints and rules the matrix by this, and the print fallback draws
 * the same partition, because the one thing a student must take away from the
 * figure is that the 4×4 is not a new object: it is two familiar ones, plus a
 * row that exists only to keep the matrix square.
 */
export type Block = "rotation" | "translation" | "bottom";

export function blockOf(row: number, col: number): Block {
  if (row === 3) return "bottom";
  return col === 3 ? "translation" : "rotation";
}

/**
 * The transform itself: the rotation in the top-left 3×3, the translation in
 * the last column, `[0 0 0 1]` underneath.
 *
 * Note what is *not* here — no scaling, no perspective. The bottom row is a
 * constant, and writing it as one is the point: an author cannot accidentally
 * produce a matrix that is not a rigid-body pose.
 */
export function homogeneous(rotation: Mat3, translation: Vec3): Mat4 {
  return [
    [rotation[0][0], rotation[0][1], rotation[0][2], translation[0]],
    [rotation[1][0], rotation[1][1], rotation[1][2], translation[1]],
    [rotation[2][0], rotation[2][1], rotation[2][2], translation[2]],
    [0, 0, 0, 1],
  ];
}

/** The rotation block, read back out — the ᴵR_R inside ᴵT_R. */
export function rotationBlock(t: Mat4): Mat3 {
  return [
    [t[0][0], t[0][1], t[0][2]],
    [t[1][0], t[1][1], t[1][2]],
    [t[2][0], t[2][1], t[2][2]],
  ];
}

/** The translation block: ᴵp_R, the origin of {R} written in {I}. */
export function translationBlock(t: Mat4): Vec3 {
  return [t[0][3], t[1][3], t[2][3]];
}

/**
 * ᴵp = ᴵT_R · ᴿp for a point given in {R}.
 *
 * Taken through the 4×4 rather than as `R·p + t` on purpose: the whole reason
 * the homogeneous form exists is that it turns "rotate, then translate" into a
 * single matrix product, and the code that draws {R} should demonstrate that
 * rather than quietly do the addition by hand. The fourth coordinate is 1
 * because a *point* is being transformed; a direction would carry 0 and come
 * out untranslated.
 */
export function applyTransform(t: Mat4, point: Vec3): Vec3 {
  const h = [point[0], point[1], point[2], 1];
  const out = [0, 1, 2].map(
    (r) => t[r][0] * h[0] + t[r][1] * h[1] + t[r][2] * h[2] + t[r][3] * h[3],
  );
  return [out[0], out[1], out[2]];
}

/** The whole 4×4, formatted row by row, `-0` folded away. */
export function formatMatrix4(t: Mat4, decimals = 2): string[][] {
  return t.map((row, r) =>
    row.map((v, c) =>
      // The bottom row is structural, not measured: printing 0.00 and 1.00
      // there would suggest three quantities that happen to be zero, when in
      // fact they can never be anything else.
      blockOf(r, c) === "bottom" ? String(v) : formatEntry(v, decimals),
    ),
  );
}

/** The orientation as a quaternion, for `<group quaternion={…}>`. */
export function transformQuaternion(t: Mat4): Quaternion {
  return matrixToQuaternion(rotationBlock(t));
}

// ─── the translation the sliders reach ────────────────────────────────────────

/**
 * Slider bounds for ᴵp_R, in basis vectors. Two either way, so {R} can be
 * pushed to the far corner of the grid without ever leaving it — a frame
 * floating outside the reference plane is a frame the student cannot read
 * coordinates off.
 */
export const POSITION_MIN = -2;
export const POSITION_MAX = 2;

export function clampCoord(value: number): number {
  // NaN is not a coordinate; it would place {R} nowhere at all.
  if (Number.isNaN(value)) return 0;
  return Math.min(POSITION_MAX, Math.max(POSITION_MIN, value));
}

export function clampPosition(p: Vec3): Vec3 {
  return [clampCoord(p[0]), clampCoord(p[1]), clampCoord(p[2])];
}

/** How a translation component is written beside its slider. */
export function formatCoord(value: number, decimals = 2): string {
  return formatEntry(value, decimals);
}

// ─── the scene ────────────────────────────────────────────────────────────────

/**
 * Both triads are one unit long — both are made of unit vectors, and the
 * distance between their origins is the only length in the figure that means
 * anything. Kept a touch shorter than `rotation-matrix`'s so that a
 * translated {R} does not overrun the grid it is measured against.
 */
export const AXIS_LENGTH = 0.9;

/** One grid square is one basis vector, two squares out in each direction. */
export const GRID_STEP = 1;
export const GRID_HALF = 2 * GRID_STEP;
export const GRID_SIZE = 2 * GRID_HALF;
export const GRID_DIVISIONS = GRID_SIZE / GRID_STEP;

export const AXIS_UNIT: Record<AxisKey, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * Pulled further back than the rotation widget's camera, because this scene is
 * not confined to the origin: {R} may sit two units away in any direction and
 * must still be in frame, with the translation arrow between the two origins
 * unforeshortened enough to read as an arrow.
 */
export const CAMERA: Camera = {
  position: [3.2, -3.9, 2.6],
  // Aimed between the two origins rather than at {I}'s: the subject of the
  // figure is the pair, and centring on the fixed frame alone leaves the
  // translated one crowding one corner of the drawing.
  target: [0.5, 0.3, 0.35],
  up: [0, 0, 1],
  fov: 40,
};

export const MIN_DISTANCE = 3;
export const MAX_DISTANCE = 16;

/** Where an axis label sits: just past the tip of its arrow, in frame-local coordinates. */
export function axisLabelAnchor(axis: AxisKey, offset = 0.2): Vec3 {
  const u = AXIS_UNIT[axis];
  const d = AXIS_LENGTH + offset;
  return [u[0] * d, u[1] * d, u[2] * d];
}

/** Where {R}'s axes end, in {I} — the print fallback draws from these. */
export function rotatedAxisTip(t: Mat4, axis: AxisKey): Vec3 {
  const u = AXIS_UNIT[axis];
  return applyTransform(t, [
    u[0] * AXIS_LENGTH,
    u[1] * AXIS_LENGTH,
    u[2] * AXIS_LENGTH,
  ]);
}

/** And where its labels go, by the same route. */
export function rotatedLabelAnchor(t: Mat4, axis: AxisKey): Vec3 {
  return applyTransform(t, axisLabelAnchor(axis));
}

/**
 * The midpoint of the translation arrow, where its name is written. Nudged up
 * along ẑ so the label clears the shaft instead of straddling it.
 */
export function translationLabelAnchor(p: Vec3, lift = 0.22): Vec3 {
  return [p[0] / 2, p[1] / 2, p[2] / 2 + lift];
}

/** Whether ᴵp_R is long enough to be worth drawing as an arrow at all. */
export function isDrawableTranslation(p: Vec3): boolean {
  return Math.hypot(p[0], p[1], p[2]) > 1e-3;
}

/**
 * The shortest-arc quaternion that swings a +Y-built primitive onto
 * `direction` — three.js builds cylinders and cones along +Y, and the
 * translation arrow points wherever the sliders say.
 */
export function arrowQuaternion(direction: Vec3): Quaternion {
  const len = Math.hypot(direction[0], direction[1], direction[2]);
  // No direction to align to: leave the primitive as it was built.
  if (len === 0) return [0, 0, 0, 1];

  const [vx, vy, vz] = [
    direction[0] / len,
    direction[1] / len,
    direction[2] / len,
  ];

  // Already along +Y: no rotation to make, and the general form below would
  // hand three.js a tuple carrying a -0 component.
  if (vy > 1 - 1e-9) return [0, 0, 0, 1];
  // Antiparallel: the shortest arc is undefined (every half-turn about a
  // horizontal axis works) and the formula collapses to the zero quaternion.
  if (vy < -1 + 1e-9) return [1, 0, 0, 0];

  const q: Quaternion = [vz, 0, -vx, 1 + vy];
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export const INTERACTION_HINT =
  "Arraste para girar a câmera · gire {R} com α, β, γ e desloque-o com os sliders de posição";
