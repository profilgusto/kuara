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

export type { Camera };
import {
  AXIS_COUNT,
  rangeTicks,
  rotationMode as dragMode,
  type AxisKey,
  type Dimension,
} from "../../dimensions";
import { ANGLE_AXES, type Mat3, type RotationMode } from "../../rotations";

export {
  AXIS_COUNT,
  DIMENSIONS,
  referenceKind,
  rollUp,
  shortestAngleDelta,
  toDimension,
  visibleAxes,
  type Dimension,
} from "../../dimensions";

/**
 * How a view answers a drag of the *camera* — `dragMode`, not `RotationMode`.
 *
 * Two vocabularies meet in this widget and both wanted the name "rotation
 * mode": one is whether the student is turning about the inertial axes or the
 * frame's own, the other is whether the stage orbits, rolls or sits still.
 * The scene one is renamed at the door, once, rather than shadowing the
 * algebra's in every file that imports both.
 */
export { dragMode };

export {
  ALIGNED_ANGLES,
  ANGLE_AXES,
  ANGLE_MAX,
  ANGLE_MIN,
  ANGLE_SYMBOLS,
  ROTATION_MODES,
  apply,
  clampAngle,
  clampAngles,
  column,
  commitStep,
  composeIntrinsic,
  elementary,
  factorOrder,
  formatEntry,
  formatMatrix,
  MAX_SHOWN_FACTORS,
  identity,
  intrinsicTrail,
  isAligned,
  matrixToQuaternion,
  multiply,
  rotationMatrix,
  shownFactors,
  sliderAngles,
  stepsFromAngles,
  toRotationMode,
  type AxisKey,
  type IntrinsicStep,
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
 * The three-quarter view the 3D scene is drawn from: none of the inertial axes
 * is foreshortened into a point, so every column of the matrix stays legible
 * on the drawing.
 */
export const CAMERA: Camera = {
  position: [2.7, -3.0, 2.2],
  target: [0, 0, 0.15],
  up: [0, 0, 1],
  fov: 40,
};

/**
 * Camera per view. The flat ones look straight down an axis, so the frame
 * reads as genuinely flat rather than as a foreshortened 3D scene; the 2D view
 * takes +y as up because looking along -z with the scene's usual +z up is
 * degenerate.
 */
export const VIEW_CAMERA: Record<Dimension, Camera> = {
  "1d": {
    position: [0, -4.4, 0],
    target: [0, 0, 0],
    up: [0, 0, 1],
    fov: 40,
  },
  "2d": {
    position: [0, 0, 4.6],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fov: 40,
  },
  "3d": CAMERA,
};

/** Where the 1D ruler is graduated: every basis vector, origin included. */
export function rulerTicks(): number[] {
  return rangeTicks(GRID_HALF, GRID_STEP);
}

/**
 * The axes a frame of this dimension can *turn about* — which is not the same
 * question as which axes it has, and is the whole content of the 1D and 2D
 * views.
 *
 * A line has no rotation at all: the only 1×1 matrix that preserves lengths
 * and orientation is [1], so the frames can never be anything but coincident.
 * A plane has exactly one: not about x̂ or ŷ, which would lift the frame out
 * of the plane, but about the ẑ it would have if it were 3D — one degree of
 * freedom, one angle, one slider. Space has all three, and only there does the
 * order they are applied in become a question.
 */
export function turnAxes(dim: Dimension): AxisKey[] {
  if (dim === "1d") return [];
  return dim === "2d" ? ["z"] : ["x", "y", "z"];
}

/**
 * The authored angles as this view can honour them: the turns it has no axis
 * for are dropped to zero rather than applied invisibly.
 *
 * The same rule the other widgets apply to a point that is authored in 3D and
 * shown in 2D — what the student sees stays an honest example of the dimension
 * it claims to be, instead of a scene quietly carrying a rotation whose axis
 * is not on the page.
 */
export function anglesFor(dim: Dimension, angles: Vec3): Vec3 {
  const allowed = turnAxes(dim);
  return ANGLE_AXES.map((axis, i) =>
    allowed.includes(axis) ? angles[i] : 0,
  ) as Vec3;
}

/**
 * The order of the matrix the panel writes: 1×1 on a line, 2×2 on a plane,
 * 3×3 in space.
 *
 * ᴵR_R relates two frames of the *same* dimension, so in a flat view the
 * panel must not print the 3×3 the code happens to carry. The leading block is
 * the honest one: with the turns this view cannot make already at zero, it is
 * [1] on a line and the [[c, -s], [s, c]] of the section on a plane.
 */
export function matrixOrder(dim: Dimension): 1 | 2 | 3 {
  return AXIS_COUNT[dim];
}

export function submatrix(m: Mat3, dim: Dimension): number[][] {
  const n = matrixOrder(dim);
  return m.slice(0, n).map((row) => row.slice(0, n));
}

/**
 * Whether the inertial/own-axis switch has anything to say.
 *
 * With one rotation available there is nothing for an order to differ about:
 * R_z(γ) is R_z(γ) whichever axes you call it about, and with none available
 * the question does not arise. Offering the switch there would suggest a
 * distinction the mathematics does not make.
 */
export function showsModeSwitch(dim: Dimension): boolean {
  return turnAxes(dim).length > 1;
}

/**
 * What the panel says in place of the controls a flat view does not need.
 * Empty in 3D, where the scene and the sliders say it themselves.
 *
 * The line's note goes further than "there is no rotation here", because the
 * next thing a reader asks is what [−1] would be — it preserves lengths, after
 * all, and it does something visible to x̂. It is a reflection: det = −1 puts
 * it outside SO(1), and O(1)'s two elements are isolated points, so no
 * continuous turn leads from [1] to it. That is the same det = +1 that the 3D
 * view's matrix quietly obeys, which is why it is worth spending a sentence on
 * where it is cheap to see.
 */
export function dimensionNote(dim: Dimension): string {
  if (dim === "1d")
    return (
      "Uma reta não pode girar: em 1D a única matriz de rotação é [1], e {R} " +
      "coincide com {I}. O [−1] também preserva comprimentos, mas inverte o " +
      "sentido de x̂: tem det = −1, então é uma reflexão, não uma rotação — e " +
      "nenhum movimento contínuo a partir de [1] chega até ele."
    );
  if (dim === "2d")
    return "No plano há um único eixo de rotação, o ẑ que sai da página — por isso girar em torno de {I} ou de {R} dá exatamente o mesmo.";
  return "";
}

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

/**
 * The hint under the stage. The sliders, not the drag, own the rotation.
 *
 * It changes with the mode because the sliders do: about the inertial axes
 * they are three angles the student holds anywhere they like, and about {R}'s
 * own axes they are a gesture that is spent when released.
 */
export function interactionHint(dim: Dimension, mode: RotationMode): string {
  if (dim === "1d") return "Sem rotação em 1D · role para aproximar";
  if (dim === "2d")
    return "Arraste para rolar a vista · use o slider para girar {R} em torno de ẑ";
  return mode === "proprio"
    ? "Arraste para girar a câmera · cada slider gira {R} em torno do próprio eixo e volta a zero, deixando o passo marcado"
    : "Arraste para girar a câmera · use os sliders para girar {R}";
}

/**
 * A note broken into lines of at most `maxChars`, for the print fallback.
 *
 * SVG text does not wrap: one `<text>` runs off the edge of the page however
 * long it is, silently. The screen panel lets CSS do this; paper has to be
 * told where the breaks go, and only whole words may move.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    // A word longer than the budget still gets its own line rather than an
    // empty one before it.
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
