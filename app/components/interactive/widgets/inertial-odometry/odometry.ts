/**
 * The odometry behind the `inertial-odometry` widget, in pure form.
 *
 * The section this block belongs to does two things to the velocities the
 * previous one derived. First it turns them, from the robot's own frame into
 * the fixed one:
 *
 *   ᴵξ̇_R = ᵀR_R  ᴿξ̇_R,   ᵀR_R = [ cos θ  -sin θ  0 ]
 *                                [ sin θ   cos θ  0 ]
 *                                [   0       0    1 ]
 *
 * and then it integrates them, which is what odometry *is*: the pose is not
 * measured, it is accumulated from what the wheels have been doing.
 *
 * The accumulation here is the lesson's own discrete sum — Euler steps of a
 * fixed Δt — rather than the closed-form arc `differential.ts` offers. That is
 * deliberate: this widget's subject is the integration, so the path the robot
 * draws must be the path the sum produces, down to its error. Turn Δt up and
 * the drawing degrades exactly as the text says it will, because the drawing
 * *is* the computation.
 *
 * The model itself — what the wheels do to the chassis — is shared with the
 * other robot widget and lives in `../../differential`.
 */
import {
  ORIGIN_POSE,
  wrapAngle,
  type BodyTwist,
  type Pose,
} from "../../differential";

/** The rows of ᵀR_R, in the order the section writes them. */
export type Matrix3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

/**
 * The transform that carries velocities from {R} into {I}.
 *
 * A plane rotation in the top-left block and a bare 1 in the corner: the yaw
 * rate is the same number in both frames, since both measure it about the same
 * vertical. Writing it out in full — including that 1 and the zeros — is the
 * point of the figure, so the panel can print the matrix the section prints.
 */
export function rotationMatrix(theta: number): Matrix3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

/**
 * ᴵξ̇_R: the chassis' velocity written in the fixed frame.
 *
 * Multiplying the matrix by ᴿξ̇ = [v, 0, ω]ᵀ collapses to (v cos θ, v sin θ, ω)
 * — the middle column never contributes, because the middle *row* of the
 * kinematic model is the zero the non-holonomic constraint put there. The
 * widget draws these two components as the legs of a right triangle under the
 * velocity arrow, and this is the function that decides their lengths.
 */
export function inertialTwist(
  { v, omega }: BodyTwist,
  theta: number,
): [number, number, number] {
  return [v * Math.cos(theta), v * Math.sin(theta), omega];
}

/**
 * One step of the sum the section writes as
 * ξ(k+1) = ξ(k) + ξ̇(k) Δt.
 *
 * The velocities are evaluated at the *start* of the step and held constant
 * across it, which is what a robot reading its encoders once per control cycle
 * actually does — and the reason the estimate lags a curve.
 */
export function odometryStep(pose: Pose, twist: BodyTwist, dt: number): Pose {
  const [dx, dy, dtheta] = inertialTwist(twist, pose.theta);
  return {
    x: pose.x + dx * dt,
    y: pose.y + dy * dt,
    theta: wrapAngle(pose.theta + dtheta * dt),
  };
}

/**
 * Everything the odometry has accumulated: where it thinks the robot is, how
 * many steps it took to get there, and the fraction of a step left over from
 * the last frame.
 */
export interface OdometryState {
  pose: Pose;
  steps: number;
  /** Time seen but not yet spent on a whole step, in seconds. */
  carry: number;
}

export const ODOMETRY_START: OdometryState = {
  pose: ORIGIN_POSE,
  steps: 0,
  carry: 0,
};

/**
 * How many steps one call will take before giving up.
 *
 * A tab that was in the background hands back every second it slept at once.
 * Without a ceiling, a small Δt would then turn one frame into tens of
 * thousands of steps and lock the page up; with one, the robot simply misses
 * the time it could not see, which is the honest outcome for a computation
 * that was not running.
 */
export const MAX_STEPS_PER_FRAME = 240;

/**
 * Advance the odometry over `elapsed` seconds of real time, in whole steps of
 * `step` seconds.
 *
 * Whole steps, with the remainder carried, is what makes the widget's motion
 * independent of the frame rate: the same second of wall clock produces the
 * same pose whether it arrived as sixty frames or as six. Anything else and
 * the odometry a student reads would depend on how busy their laptop was.
 */
export function integrate(
  state: OdometryState,
  twist: BodyTwist,
  elapsed: number,
  step: number,
): OdometryState {
  // A non-positive step would spin forever; treat it as "no clock, no motion".
  if (!(step > 0) || !Number.isFinite(elapsed) || elapsed <= 0) return state;

  let { pose, steps } = state;
  let carry = state.carry + elapsed;
  let taken = 0;

  // The slack matters: adding a second and then subtracting ten steps of a
  // tenth leaves a carry a hair under one step, and the tenth step would be
  // postponed to the next frame. It comes out in the wash over time, but the
  // clock the panel prints would keep falling a step behind the wall clock and
  // then catching up, which is a wobble a student can see in T.
  const slack = step * 1e-9;
  while (carry >= step - slack && taken < MAX_STEPS_PER_FRAME) {
    pose = odometryStep(pose, twist, step);
    carry -= step;
    steps += 1;
    taken += 1;
  }

  // Whatever could not be taken is dropped rather than banked: banking it
  // would make the robot bolt across the plane to catch up on a frame the
  // student never saw.
  if (carry >= step) carry = 0;

  return { pose, steps, carry };
}

/** The T of the section's ξ(T): how much time the sum has accounted for. */
export function elapsedTime(state: OdometryState, step: number): number {
  return state.steps * step;
}

// ─── the stage ────────────────────────────────────────────────────────────────

/**
 * Half the width of the floor the block opens on, as a multiple of the track.
 * Wider than the other widget's: here the robot drives away from a fixed
 * origin rather than being followed, so it needs room to leave.
 */
export const VIEW_HALF_EXTENT_IN_TRACKS = 3;

export function baseHalfExtent(track: number): number {
  return VIEW_HALF_EXTENT_IN_TRACKS * track;
}

/** How far the view will zoom out to keep the robot with its frame. */
export const MAX_FIT_GROWTH = 12;

/**
 * Where the camera looks: halfway between the origin and the robot.
 *
 * The invariant the block needs is that {I} never leaves the stage — a pose is
 * measured from somewhere, and a figure that lost the somewhere would be
 * measuring nothing. Pinning the camera *on* the origin satisfies that but
 * spends three quarters of the stage on empty floor as soon as the robot
 * commits to a direction. Framing the pair instead keeps both ends of the
 * position vector on screen and puts the drawing where the reader is looking.
 */
export function fitCentre(pose: Pose): [number, number] {
  return [pose.x / 2, pose.y / 2];
}

/**
 * How much floor to show: enough to hold {I} and the robot at once, around
 * the centre `fitCentre` picks.
 *
 * Both are exactly half the robot's distance from that centre, so half the
 * distance plus a margin is the whole rule — until the cap, past which the
 * robot is a long way from home and the numbers, not the picture, are what is
 * worth reading.
 */
export function fitHalfExtent(base: number, pose: Pose, margin = 1.4): number {
  const half = (Math.max(Math.abs(pose.x), Math.abs(pose.y)) / 2) * margin;
  return Math.min(Math.max(base, half), base * MAX_FIT_GROWTH);
}

/** Floor rulings to choose between, in metres, coarsest last. */
const GRID_CELLS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];

/** The most squares the floor is ruled into across its width. */
export const MAX_GRID_LINES = 24;

/**
 * Which ruling the floor takes at a given zoom.
 *
 * Fixed at a tenth of a metre, the grid is a useful scale at the start and a
 * grey mass once the robot has driven a few metres out. Stepping up through
 * round numbers keeps it countable at every zoom — and keeps it a *scale*,
 * which is its only job here.
 */
export function gridCellFor(halfExtent: number): number {
  const width = 2 * halfExtent;
  for (const cell of GRID_CELLS) {
    if (width / cell <= MAX_GRID_LINES) return cell;
  }
  return GRID_CELLS[GRID_CELLS.length - 1];
}

/**
 * Where the θ arc is drawn around the robot: from the direction the fixed
 * frame calls forward, round to where the robot is actually pointing.
 *
 * Always from x̂_I, never from the robot's own axis — θ is the angle *between*
 * the two frames, and an arc that started at the robot would be measuring from
 * the thing being measured.
 */
export function headingArc(
  pose: Pose,
  radius: number,
  samples = 24,
): [number, number][] {
  const points: [number, number][] = [];
  const n = Math.max(2, Math.floor(samples));
  for (let i = 0; i < n; i++) {
    const t = (pose.theta * i) / (n - 1);
    points.push([pose.x + radius * Math.cos(t), pose.y + radius * Math.sin(t)]);
  }
  return points;
}

/** The distance from the origin to the robot — the length of ᴵp_R. */
export function positionMagnitude(pose: Pose): number {
  return Math.hypot(pose.x, pose.y);
}

/** Degrees, for the heading readout: radians are not what a reader pictures. */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
