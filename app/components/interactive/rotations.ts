/**
 * components/interactive/rotations.ts
 *
 * The algebra of orientation, shared by every widget that has one.
 *
 * `rotation-matrix` builds ᴵR_R from three slider angles; `homogeneous-transform`
 * builds the same block and hangs a translation beside it. If each carried its
 * own copy of the elementary rotations, the two figures could disagree about
 * what R_y(30°) is — a lesson-level bug that no amount of rendering care would
 * catch. One implementation, one set of tests, both scenes.
 *
 * Row-major 3×3 because that is how the matrix is written on the page and
 * drawn in the panels; the column that matters mathematically — ᴵx̂_R and its
 * siblings — is read out by `column()` rather than being the storage order, so
 * the two readings can never be confused at a call site.
 *
 * Pure: no three.js and no React. Orientation leaves here as a raw quaternion
 * tuple, which `<group quaternion={…}>` takes directly.
 */
import type { Vec3 } from "./props";
import type { AxisKey } from "./dimensions";

export type { AxisKey } from "./dimensions";

/** A 3×3 matrix as three **rows**, `m[row][col]`. */
export type Mat3 = [Vec3, Vec3, Vec3];

/** `[x, y, z, w]`, the tuple three.js's `quaternion` prop expects. */
export type Quaternion = [number, number, number, number];

/**
 * Which axes a rotation is taken about.
 *
 * `"inercial"` turns the frame about the *fixed* axes of {I} (extrinsic);
 * `"proprio"` turns it about the axes it carries with it, as they stand after
 * the previous rotation (intrinsic). The distinction is the whole point of the
 * mode switch: the same three angles give two different orientations, and the
 * matrices are each other's factors in reverse.
 */
export const ROTATION_MODES = ["inercial", "proprio"] as const;
export type RotationMode = (typeof ROTATION_MODES)[number];

/** An unrecognised mode reads as the inertial one — the widgets' default. */
export function toRotationMode(raw: string | undefined): RotationMode {
  return ROTATION_MODES.includes(raw as RotationMode)
    ? (raw as RotationMode)
    : "inercial";
}

/**
 * The sliders' angles, in degrees, in the order they are applied: about x,
 * then y, then z. The letters are the ones the course text uses.
 */
export const ANGLE_SYMBOLS: Record<AxisKey, string> = {
  x: "α",
  y: "β",
  z: "γ",
};

/** The order the axes are rotated about, and the order the sliders sit in. */
export const ANGLE_AXES: AxisKey[] = ["x", "y", "z"];

/** Slider bounds: a full turn either way, with the identity at the centre. */
export const ANGLE_MIN = -180;
export const ANGLE_MAX = 180;

/** Keep an authored angle inside the track the student can reach. */
export function clampAngle(deg: number): number {
  // NaN is not an angle; it would propagate into every matrix entry and blank
  // the scene, so it reads as no rotation at all.
  if (Number.isNaN(deg)) return 0;
  return Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, deg));
}

export function clampAngles(angles: Vec3): Vec3 {
  return [clampAngle(angles[0]), clampAngle(angles[1]), clampAngle(angles[2])];
}

const toRadians = (deg: number) => (deg * Math.PI) / 180;

export function identity(): Mat3 {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

/**
 * An elementary rotation of `deg` degrees about one axis, right-handed — the
 * R_x, R_y, R_z of the text.
 */
export function elementary(axis: AxisKey, deg: number): Mat3 {
  const c = Math.cos(toRadians(deg));
  const s = Math.sin(toRadians(deg));
  switch (axis) {
    case "x":
      return [
        [1, 0, 0],
        [0, c, -s],
        [0, s, c],
      ];
    case "y":
      return [
        [c, 0, s],
        [0, 1, 0],
        [-s, 0, c],
      ];
    default:
      return [
        [c, -s, 0],
        [s, c, 0],
        [0, 0, 1],
      ];
  }
}

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = identity();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c];
    }
  }
  return out;
}

/**
 * ᴵR_R for the three slider angles, under the selected mode.
 *
 * Both modes apply the *same* rotations in the *same* order — x, then y, then
 * z — and differ only in which side each new one multiplies on, which is
 * exactly the rule the section states:
 *
 *   - about the inertial axes, a new rotation **pre**-multiplies:
 *     ᴵR_R = R_z(γ) R_y(β) R_x(α);
 *   - about the frame's own axes, it **post**-multiplies:
 *     ᴵR_R = R_x(α) R_y(β) R_z(γ).
 *
 * Reading one product backwards gives the other, which is why the two modes
 * agree whenever only one slider is off zero and part company as soon as two
 * are.
 */
export function rotationMatrix(anglesDeg: Vec3, mode: RotationMode): Mat3 {
  const factors = ANGLE_AXES.map((axis, i) => elementary(axis, anglesDeg[i]));
  return factors.reduce(
    (acc, factor) =>
      mode === "inercial" ? multiply(factor, acc) : multiply(acc, factor),
    identity(),
  );
}

/**
 * The factors as the panel writes them, left to right — the product above,
 * spelled out so the student can see the order change when they flip the
 * switch.
 */
export function factorOrder(mode: RotationMode): AxisKey[] {
  return mode === "inercial" ? ["z", "y", "x"] : ["x", "y", "z"];
}

/**
 * Column `index` of the matrix: ᴵx̂_R, ᴵŷ_R, ᴵẑ_R — the basis vectors of {R}
 * resolved in {I}, which is what the columns of a rotation matrix *are*.
 */
export function column(m: Mat3, index: 0 | 1 | 2): Vec3 {
  return [m[0][index], m[1][index], m[2][index]];
}

/**
 * An entry as a panel prints it: a fixed number of decimals so the columns
 * keep their width while a slider is dragged, and never the `-0` that a
 * rounded negative zero would otherwise show.
 */
export function formatEntry(value: number, decimals = 2): string {
  const rounded = Number(value.toFixed(decimals));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals);
}

/** The whole matrix, formatted row by row. */
export function formatMatrix(m: Mat3, decimals = 2): string[][] {
  return m.map((row) => row.map((v) => formatEntry(v, decimals)));
}

/**
 * The orientation as a quaternion, for `<group quaternion={…}>`.
 *
 * Shepperd's method: the branch on the largest diagonal term avoids the
 * division by a near-zero `S` that the trace formula alone suffers from at
 * half-turns — exactly the orientations a ±180° slider reaches.
 */
export function matrixToQuaternion(m: Mat3): Quaternion {
  const [[m00, m01, m02], [m10, m11, m12], [m20, m21, m22]] = m;
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

/** Rotate a vector by the matrix — how a print fallback places {R}'s axes. */
export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}
