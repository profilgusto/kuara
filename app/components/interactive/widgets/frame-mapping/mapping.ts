/**
 * The mathematics and the scene of the `frame-mapping` widget.
 *
 * The section this widget illustrates answers one question: a point m is
 * known in {A}, and we want it in {B}. The answer is the mapping
 *
 *     ᴮp_m = ᴮR_A · ᴬp_m + ᴮp_A,
 *
 * and the whole difficulty for a student is that the three quantities on the
 * right are read in *different* frames — ᴬp_m in {A}, ᴮR_A and ᴮp_A in {B} —
 * while the scene shows only one arrangement of arrows. So this module keeps
 * the two descriptions apart and derives one from the other:
 *
 *   - the student places {B} the way anyone would think of it, by saying
 *     where it sits and how it is turned *relative to {A}* — ᴬp_B and ᴬR_B;
 *   - the panel writes the quantities the formula actually needs, which are
 *     the inverse pose: ᴮR_A = (ᴬR_B)ᵀ and ᴮp_A = −ᴮR_A · ᴬp_B.
 *
 * That inversion is the step the figure in the notes silently performs, and
 * doing it here — once, in a tested pure function — is what stops the widget
 * from teaching a sign error.
 *
 * The rotation half comes from `components/interactive/rotations.ts`, the same
 * code `rotation-matrix` and `homogeneous-transform` teach from: ᴬR_B here
 * *is* the ᴵR_R there, and the three figures must never disagree about it.
 *
 * No three.js and no React, so every number is verifiable in Phase 1.
 */
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import {
  apply,
  formatEntry,
  rotationMatrix,
  type AxisKey,
  type Mat3,
  type Quaternion,
} from "../../rotations";

export {
  ANGLE_MAX,
  ANGLE_MIN,
  ANGLE_SYMBOLS,
  apply,
  clampAngle,
  clampAngles,
  formatEntry,
  identity,
  matrixToQuaternion,
  rotationMatrix,
  type AxisKey,
  type Mat3,
  type Quaternion,
} from "../../rotations";

// ─── the two views ────────────────────────────────────────────────────────────

/**
 * Which views the header switch offers.
 *
 * There is no 1D view here, unlike `position-vector`: on a line a frame has no
 * orientation to speak of, so ᴮR_A would be ±1 and the mapping would collapse
 * to an addition — a figure that teaches nothing the section has not already
 * said in one line.
 */
export const VIEWS = ["2d", "3d"] as const;
export type View = (typeof VIEWS)[number];

/**
 * An unknown or absent `variant` reads as the space, which is the view the
 * block opens on — the widget must still draw itself where nothing sets the
 * prop: the admin thumbnail, a direct import in a test.
 */
export function toView(variant: string | undefined): View {
  return VIEWS.includes(variant as View) ? (variant as View) : "3d";
}

/** How many coordinates a view has — the width of every vector it prints. */
export function axisCount(view: View): 2 | 3 {
  return view === "2d" ? 2 : 3;
}

/** The axes the view draws, in order. */
export function viewAxes(view: View): AxisKey[] {
  return view === "2d" ? ["x", "y"] : ["x", "y", "z"];
}

/**
 * Which angles the view lets the student set.
 *
 * In the plane there is exactly one rotation available — about the ẑ the
 * scene would have if it were 3D — and offering α or β there would let the
 * student tip {B} out of the plane its own figure lives in.
 */
export function angleAxes(view: View): AxisKey[] {
  return view === "2d" ? ["z"] : ["x", "y", "z"];
}

/**
 * A 3-tuple as this view has it: coordinates the view does not draw are
 * dropped to zero rather than carried invisibly, so what the panel prints is
 * an honest reading of what is on the stage.
 *
 * The dropped values are not lost — the component holds the full tuple, so
 * flipping to 3D and back returns the student's z instead of zeroing it.
 */
export function flatten(v: Vec3, view: View): Vec3 {
  return view === "2d" ? [v[0], v[1], 0] : [v[0], v[1], v[2]];
}

// ─── the pose of {B}, and its inverse ─────────────────────────────────────────

/**
 * A pose: where a frame's origin sits and how it is turned, both read in the
 * frame the superscript names.
 */
export interface Pose {
  rotation: Mat3;
  position: Vec3;
}

export function transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

export function negate(v: Vec3): Vec3 {
  // Written component-wise rather than as a map so that a -0 never reaches the
  // formatter: negating a zero component would otherwise print "-0.0".
  return [
    v[0] === 0 ? 0 : -v[0],
    v[1] === 0 ? 0 : -v[1],
    v[2] === 0 ? 0 : -v[2],
  ];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * The pose of {B} seen from {A}, built from the student's sliders: the angles
 * are read about the fixed axes of {A}, as in `rotation-matrix`'s inertial
 * mode, because that is the reading a student can predict from a figure.
 */
export function poseOf(anglesDeg: Vec3, position: Vec3): Pose {
  return { rotation: rotationMatrix(anglesDeg, "inercial"), position };
}

/**
 * The same rigid arrangement, described from the other side: ᴮR_A and ᴮp_A.
 *
 * ᴮR_A is the transpose because a rotation matrix is orthogonal — its inverse
 * costs nothing. ᴮp_A is **not** simply −ᴬp_B: it is that displacement
 * resolved in {B}'s own axes, which is why the rotation has to act on it.
 * Getting this wrong is the single most common error in the exercise, and it
 * is silent — the arrows still look right, only the numbers lie.
 */
export function invertPose(pose: Pose): Pose {
  const rotation = transpose(pose.rotation);
  return { rotation, position: negate(apply(rotation, pose.position)) };
}

/**
 * The mapping itself: ᴮp_m = ᴮR_A · ᴬp_m + ᴮp_A.
 *
 * Taken in exactly the two steps the panel prints — rotate, then add — rather
 * than through a 4×4, because the point of this figure is the two steps.
 */
export function mapPoint(pose: Pose, point: Vec3): Vec3 {
  return add(apply(pose.rotation, point), pose.position);
}

/** The rotated half on its own: ᴮR_A · ᴬp_m, the first term the panel shows. */
export function rotatedTerm(pose: Pose, point: Vec3): Vec3 {
  return apply(pose.rotation, point);
}

/**
 * A point given in {B}, carried back into {A} — how the scene places
 * something the student reads off the {B} panel.
 *
 * The widget itself works forwards, but the round trip is what a test can
 * check the mapping against without restating its formula.
 */
export function unmapPoint(pose: Pose, point: Vec3): Vec3 {
  return apply(transpose(pose.rotation), [
    point[0] - pose.position[0],
    point[1] - pose.position[1],
    point[2] - pose.position[2],
  ]);
}

// ─── the reachable world ──────────────────────────────────────────────────────

/**
 * How far the sliders reach, in every direction — and exactly how far the
 * grid is drawn. A point that can be dialled past the edge of the graduation
 * is a point the student can no longer read off anything.
 */
export const RANGE = 7;

/** One grid square is one basis vector. */
export const GRID_STEP = 1;
export const GRID_SIZE = 2 * RANGE;
export const GRID_DIVISIONS = GRID_SIZE / GRID_STEP;

export const SLIDER_MIN = -RANGE;
export const SLIDER_MAX = RANGE;

export function clampCoord(value: number): number {
  // NaN is not a coordinate — it would poison every arrow's direction and
  // blank the stage — so it reads as the origin.
  if (Number.isNaN(value)) return 0;
  return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value));
}

/**
 * Keep an authored position inside the graduated world.
 *
 * The sliders cannot leave it, but `vec3` will happily parse a "20,0,0" that
 * no slider could ever bring back into view.
 */
export function clampVector(v: Vec3): Vec3 {
  return [clampCoord(v[0]), clampCoord(v[1]), clampCoord(v[2])];
}

// ─── how the panel writes it ──────────────────────────────────────────────────

/** A vector as a column of this view's width, formatted. */
export function vectorEntries(v: Vec3, view: View, decimals = 1): string[] {
  return v.slice(0, axisCount(view)).map((c) => formatEntry(c, decimals));
}

/** A matrix cropped to this view's axes, formatted row by row. */
export function matrixEntries(m: Mat3, view: View, decimals = 1): string[][] {
  const n = axisCount(view);
  return m
    .slice(0, n)
    .map((row) => row.slice(0, n).map((v) => formatEntry(v, decimals)));
}

// ─── the scene ────────────────────────────────────────────────────────────────

/**
 * Both triads are one unit long, because both are made of unit vectors and the
 * grid squares they stand on are the same unit. They are small against a
 * fourteen-square world, and deliberately so: the lengths that matter in this
 * figure are the three vectors between the origins and the point, not the
 * triads that give them their names.
 */
export const AXIS_LENGTH = 1;

/**
 * The flat view looks straight down ẑ with +y up on screen — the orientation
 * the worked example is drawn in, so a student can lay the page beside the
 * screen. It stands far enough back to hold the whole ±7 graduation.
 */
export const VIEW_CAMERA: Record<View, Camera> = {
  "2d": {
    position: [0.5, 0.5, 21],
    target: [0.5, 0.5, 0],
    up: [0, 1, 0],
    fov: 40,
  },
  // Pulled onto the usual diagonal, and aimed a little above the plane: half
  // of what the student can dial lies over the grid, and centring on the
  // origin alone wastes the top of the stage.
  // The 3D view opens close in, on the action rather than on the whole
  // graduation: the three vectors and the two triads are what has to be
  // legible, and a camera that holds all fourteen squares renders them as a
  // thin band of colour across an empty floor. The far corners of the
  // dial-able world start off-stage; the student scrolls out to meet them,
  // which is the gesture the hint already names.
  "3d": {
    position: [10.5, -8.5, 11],
    // Aimed between the two origins, not at {A}'s: the subject of the figure
    // is the pair and the point between them.
    target: [3, 2, 0.8],
    up: [0, 0, 1],
    fov: 40,
  },
};

export const MIN_DISTANCE = 6;
export const MAX_DISTANCE = 42;

export const AXIS_UNIT: Record<AxisKey, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/** Where an axis label sits: just past its arrow, in frame-local coordinates. */
export function axisLabelAnchor(axis: AxisKey, offset = 0.42): Vec3 {
  const u = AXIS_UNIT[axis];
  const d = AXIS_LENGTH + offset;
  return [u[0] * d, u[1] * d, u[2] * d];
}

/** Where {B}'s axis tips land in {A} — the print fallback draws from these. */
export function targetAxisTip(pose: Pose, axis: AxisKey): Vec3 {
  const u = AXIS_UNIT[axis];
  return add(
    apply(pose.rotation, [
      u[0] * AXIS_LENGTH,
      u[1] * AXIS_LENGTH,
      u[2] * AXIS_LENGTH,
    ]),
    pose.position,
  );
}

/** And where its labels go, by the same route. */
export function targetLabelAnchor(pose: Pose, axis: AxisKey): Vec3 {
  return add(apply(pose.rotation, axisLabelAnchor(axis)), pose.position);
}

/**
 * Where a vector's name is written: a point along its own shaft, pushed off to
 * one side of it.
 *
 * A midpoint alone is not enough here. The three arrows of this figure are
 * very nearly collinear in the worked example — o_B → o_A → m is almost a
 * straight line — so three labels placed at three midpoints land on top of one
 * another and on the arrows themselves. Sliding each one to a different
 * fraction of its shaft and pushing it out along the shaft's own normal, on a
 * side the caller chooses, keeps them apart under any pose the sliders reach.
 *
 * The normal is taken in the xy plane because that is the plane the flat view
 * shows and the one the grid is drawn on; `lift` is what separates a label
 * from its shaft in the 3D view, where an in-plane offset alone foreshortens
 * to nothing on an arrow seen end-on.
 */
export function vectorLabelAnchor(
  from: Vec3,
  to: Vec3,
  { at = 0.5, side = 1, offset = 0.45, lift = 0 } = {},
): Vec3 {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const flat = Math.hypot(dx, dy);
  // An arrow standing straight up has no direction in the plane to be normal
  // to; push the label out along x̂, which is across it in every view.
  const [nx, ny] = flat > 1e-6 ? [-dy / flat, dx / flat] : [1, 0];

  return [
    from[0] + dx * at + nx * side * offset,
    from[1] + dy * at + ny * side * offset,
    from[2] + (to[2] - from[2]) * at + lift,
  ];
}

/**
 * Where a frame's name is written: beside its origin, on the side facing away
 * from the *other* frame.
 *
 * A fixed corner does not work here. The two origins can be dialled arbitrarily
 * close, and the point m usually sits between them — so a name hung
 * down-and-left of every origin lands on whatever happens to be there, which
 * in the worked example is the point itself. Pushing each name outward along
 * the line joining the frames keeps the space between them, where all three
 * vectors and the point live, clear of type.
 */
export function frameLabelAnchor(
  origin: Vec3,
  other: Vec3,
  distance = 0.85,
): Vec3 {
  const dx = origin[0] - other[0];
  const dy = origin[1] - other[1];
  const len = Math.hypot(dx, dy);
  // Frames sharing an origin have no line to be pushed out along; down-left
  // is the corner every other figure in the family uses.
  const [ux, uy] =
    len > 1e-6 ? [dx / len, dy / len] : [-Math.SQRT1_2, -Math.SQRT1_2];
  return [origin[0] + ux * distance, origin[1] + uy * distance, origin[2]];
}

/**
 * An arrow shorter than this is treated as no arrow at all: its direction is
 * numerically meaningless, and an arrowhead longer than its own shaft draws as
 * a cone sticking out the wrong side of the origin.
 */
const MIN_DRAWN_LENGTH = 1e-3;

export function isDrawable(from: Vec3, to: Vec3): boolean {
  return (
    Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) >
    MIN_DRAWN_LENGTH
  );
}

/**
 * The rotation that aims a +Y-oriented cylinder/cone — three.js builds both
 * that way — along `direction`.
 *
 * The same shortest-arc construction `position-vector`, `homogeneous-transform`
 * and `differential-drive` carry in their own geometry modules; kept local for
 * the same reason they do, so that a widget's scene depends on nothing but its
 * own maths and the shared vocabulary.
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

  // Already along +Y: the general form below would hand three.js a tuple
  // carrying a -0 component.
  if (vy > 1 - 1e-9) return [0, 0, 0, 1];
  // Antiparallel: every half-turn about a horizontal axis is a shortest arc,
  // and the formula collapses to the zero quaternion. Pick the one about +x.
  if (vy < -1 + 1e-9) return [1, 0, 0, 0];

  // Shortest arc from +Y: axis = ŷ × v, angle folded into w = 1 + ŷ·v.
  const q: Quaternion = [vz, 0, -vx, 1 + vy];
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/**
 * The hint under the stage. The plane does not orbit: a 2D figure seen from an
 * angle is no longer a 2D figure, and the one rotation this scene has is the
 * one the γ slider already owns.
 */
export function interactionHint(view: View): string {
  return view === "3d"
    ? "Arraste para girar a câmera · role para aproximar · os sliders movem m e a pose de {B}"
    : "Role para aproximar · os sliders movem m e a pose de {B}";
}
