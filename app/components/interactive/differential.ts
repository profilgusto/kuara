/**
 * components/interactive/differential.ts
 *
 * The differential-drive model, and the vocabulary for drawing one from above.
 *
 * Two widgets in the "Cinemática de robôs móveis terrestres" module stand on
 * this: `differential-kinematics`, which drives the robot from either end of
 * Eq. (3), and `inertial-odometry`, which integrates the same velocities in
 * the fixed frame. They must not disagree — a student who sees two robots
 * obeying two slightly different laws in one lesson has been taught a bug —
 * so the law lives here rather than in either of them, exactly as the 1D/2D/3D
 * vocabulary lives in `dimensions.ts` rather than in each widget that offers
 * the switch.
 *
 * What stays with a widget is its own staging: how far its camera stands back,
 * how wide it draws an arc, when it bothers to mark the centre of rotation.
 * What lives here is everything a *robot* is:
 *
 *   ᴿξ̇ = [ r/2   r/2 ] [ω_l]        [ω_l]   [ 1/r  -d/2r ] [v]
 *        [  0     0  ] [ω_r]   and  [ω_r] = [ 1/r   d/2r ] [ω]
 *        [-r/d   r/d ]
 *
 * The middle row of zeros is the non-holonomic constraint, and it is the
 * reason the inverse above is written with two columns rather than three: ᴿẏ
 * is not something the student may ask for, so the inverse takes only the two
 * velocities the robot can actually produce.
 *
 * Arithmetic on numbers — no three.js, no React — so the relation the widgets
 * teach is checkable in Phase 1 rather than by dragging a slider and squinting.
 */

/** The robot's pose in the inertial frame {I}. Angles in radians. */
export interface Pose {
  x: number;
  y: number;
  theta: number;
}

/** What the two motors are doing, in rad/s. */
export interface WheelSpeeds {
  left: number;
  right: number;
}

/** What the chassis does as a result: forward speed and yaw rate. */
export interface BodyTwist {
  /** ᴿẋ_R, in m/s. */
  v: number;
  /** ᴿθ̇_R, in rad/s. */
  omega: number;
}

/** The robot's physical parameters, as the lesson names them. */
export interface RobotParams {
  /** `r` — wheel radius, in metres. */
  r: number;
  /** `d` — track: distance between the wheels' contact points, in metres. */
  d: number;
}

export const ORIGIN_POSE: Pose = { x: 0, y: 0, theta: 0 };

// ─── the relation, forwards ───────────────────────────────────────────────────

/**
 * Eq. (3): what the chassis does, given what the wheels do.
 *
 * `v` is the mean of the two rim speeds and `omega` their difference over the
 * track. Both wheels turning together is pure translation; equal and opposite
 * is pure rotation about the axle's midpoint — which is why the frame's origin
 * was put there in the first place.
 */
export function forward(
  { left, right }: WheelSpeeds,
  { r, d }: RobotParams,
): BodyTwist {
  return {
    v: (r * left) / 2 + (r * right) / 2,
    omega: -(r * left) / d + (r * right) / d,
  };
}

/**
 * The three rows of ᴿξ̇, in the order the equation writes them.
 *
 * The zero is returned rather than omitted: the panel prints the whole column,
 * because a constraint the reader cannot see is a constraint they will forget.
 */
export function bodyVelocity(
  wheels: WheelSpeeds,
  params: RobotParams,
): [number, number, number] {
  const { v, omega } = forward(wheels, params);
  return [v, 0, omega];
}

// ─── the relation, backwards ──────────────────────────────────────────────────

/**
 * The inverse of Eq. (3): what the wheels must do for a wanted (v, ω).
 *
 * Solving the two non-trivial rows for ω_l and ω_r gives
 *   ω_l = v/r - ωd/2r,   ω_r = v/r + ωd/2r,
 * i.e. every wheel runs at the speed the translation needs, plus or minus
 * half of what the rotation needs. It is a left inverse, not a true one: the
 * 3×2 matrix cannot be inverted, and what makes the problem solvable is
 * precisely that ᴿẏ is fixed at zero rather than free.
 */
export function inverse(
  { v, omega }: BodyTwist,
  { r, d }: RobotParams,
): WheelSpeeds {
  const half = (omega * d) / (2 * r);
  return { left: v / r - half, right: v / r + half };
}

// ─── how far the sliders may go ───────────────────────────────────────────────

/** What a motor can do, in rad/s — the range of the direct mode's sliders. */
export const WHEEL_SPEED_MAX = 10;

/**
 * The reach of the inverse mode's sliders, derived from the motors' own.
 *
 * Split the wheels' budget in two: the translation gets the sum, the rotation
 * gets the difference. Then the extreme corner — full speed ahead *and* full
 * yaw — asks exactly `WHEEL_SPEED_MAX` of one wheel and zero of the other, so
 * every (v, ω) the student can dial is a (v, ω) the robot can actually
 * produce. Widen either limit and the inverse would start returning wheel
 * speeds no motor could deliver, which is a lie the figure would tell
 * silently.
 */
export function bodyLimits({ r, d }: RobotParams): {
  vMax: number;
  omegaMax: number;
} {
  return {
    vMax: (r * WHEEL_SPEED_MAX) / 2,
    omegaMax: (r * WHEEL_SPEED_MAX) / d,
  };
}

export function clamp(value: number, limit: number): number {
  // NaN is not a speed; it would poison the pose and blank the scene.
  if (Number.isNaN(value)) return 0;
  return Math.min(limit, Math.max(-limit, value));
}

export function clampWheels({ left, right }: WheelSpeeds): WheelSpeeds {
  return {
    left: clamp(left, WHEEL_SPEED_MAX),
    right: clamp(right, WHEEL_SPEED_MAX),
  };
}

/**
 * Bring a twist inside what the inverse sliders can express.
 *
 * Needed when the student switches modes: the direct sliders can ask for a
 * spin on the spot at both motors' full speed, which is a yaw rate beyond
 * what the inverse mode — sharing its budget with the translation — offers.
 * Clamping keeps the two modes describing one robot instead of two.
 */
export function clampTwist(twist: BodyTwist, params: RobotParams): BodyTwist {
  const { vMax, omegaMax } = bodyLimits(params);
  return { v: clamp(twist.v, vMax), omega: clamp(twist.omega, omegaMax) };
}

// ─── driving the thing ────────────────────────────────────────────────────────

/** Below this yaw rate the path is taken as a straight line. */
const STRAIGHT_EPS = 1e-9;

/**
 * Advance the pose by `dt` seconds under a constant twist.
 *
 * This is the exact solution, not an Euler step: under constant (v, ω) the
 * robot runs along a circular arc, and integrating it in closed form means a
 * circle closes on itself however coarse the frame rate. The lesson's own
 * odometry section makes the opposite point — that summing Δt by Δt drifts —
 * and a widget that drifted the same way would blur the two ideas together.
 */
export function advance(pose: Pose, { v, omega }: BodyTwist, dt: number): Pose {
  if (Math.abs(omega) < STRAIGHT_EPS) {
    return {
      x: pose.x + v * Math.cos(pose.theta) * dt,
      y: pose.y + v * Math.sin(pose.theta) * dt,
      theta: pose.theta,
    };
  }

  const theta = pose.theta + omega * dt;
  // The signed radius of the arc: the same v/ω the ICR sits at.
  const radius = v / omega;
  return {
    x: pose.x + radius * (Math.sin(theta) - Math.sin(pose.theta)),
    y: pose.y - radius * (Math.cos(theta) - Math.cos(pose.theta)),
    theta: wrapAngle(theta),
  };
}

/**
 * Fold an angle back into [-π, π].
 *
 * The pose is integrated for as long as the block is on screen, and an
 * unwrapped θ grows without bound: after a few minutes of spinning, the float
 * has spent its precision on whole turns nobody can see.
 *
 * The interval is closed at both ends on purpose. Exactly half a turn is the
 * one angle that belongs to either end, and which one a round trip through
 * sin/cos lands on is decided by the last bit of the input — a distinction
 * without a difference for a heading, and not worth writing a special case
 * for.
 */
export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Round a pose to a precision no drawing can resolve.
 *
 * The printed fallback is rendered on the server and hydrated in the browser,
 * and `advance` reaches the pose through `Math.sin`/`Math.cos`, which the two
 * engines are free to disagree about in the last bit. Normally invisible — but
 * anything that then *rounds* amplifies it: the floor's `gridAnchor` snaps to
 * whole cells, so a pose landing exactly on a half-cell boundary snapped one
 * way on the server and the other in the browser, and React reported the whole
 * grid as a hydration mismatch. Quantising first makes both sides round the
 * same number.
 */
export function quantisePose(pose: Pose, decimals = 6): Pose {
  const round = (value: number) => Number(value.toFixed(decimals));
  return { x: round(pose.x), y: round(pose.y), theta: round(pose.theta) };
}

/**
 * Signed distance from the robot's origin to the instantaneous centre of
 * rotation, measured along ŷ_R — `null` when the path is straight and the
 * centre is at infinity.
 *
 * This is the geometric content of the whole equation: the two wheels roll on
 * circles about one point, and where that point falls is what "differential"
 * means. Positive is to the robot's left, because ŷ_R points left.
 */
export function icrDistance({ v, omega }: BodyTwist): number | null {
  if (Math.abs(omega) < STRAIGHT_EPS) return null;
  return v / omega;
}

/**
 * The rim speed of each wheel, in m/s: v = r ω, the quantity the companion
 * figure draws as v_l and v_r.
 */
export function wheelLinearSpeeds(
  { left, right }: WheelSpeeds,
  { r }: RobotParams,
): { left: number; right: number } {
  return { left: r * left, right: r * right };
}

// ─── how the robot is drawn, seen from above ──────────────────────────────────

/**
 * The robot's outline is derived from `r` and `d` rather than fixed, so the
 * drawing always agrees with the numbers on the sliders: set a wheel radius a
 * third of the track and the wheels drawn really are a third of the track.
 *
 * Everything is a fraction of `d` except the wheels' length, which is 2r
 * because that is what a wheel of radius r looks like from above.
 */
export interface RobotOutline {
  chassisRadius: number;
  wheelLength: number;
  wheelWidth: number;
  wheelOffset: number;
  castorOffset: number;
  castorRadius: number;
}

export function robotOutline({ r, d }: RobotParams): RobotOutline {
  return {
    // Narrower than the track, so the wheels stay outside the shell and the
    // student can see what `d` is measured between.
    chassisRadius: 0.42 * d,
    wheelLength: 2 * r,
    wheelWidth: 0.14 * d,
    wheelOffset: d / 2,
    // Behind the axle, as in the companion figure: on the +x̂_R side a castor
    // reads as a steering wheel, which this architecture has not got.
    castorOffset: -0.3 * d,
    castorRadius: 0.07 * d,
  };
}

/** A point in the robot's own frame, taken to the inertial frame. */
export function toWorld(pose: Pose, x: number, y: number): [number, number] {
  const c = Math.cos(pose.theta);
  const s = Math.sin(pose.theta);
  return [pose.x + c * x - s * y, pose.y + s * x + c * y];
}

/** Where each wheel's centre sits, in the robot's own frame. ŷ_R points left. */
export function wheelOrigin(
  side: "l" | "r",
  outline: RobotOutline,
): [number, number] {
  return [0, side === "l" ? outline.wheelOffset : -outline.wheelOffset];
}

// ─── the stage ────────────────────────────────────────────────────────────────

/**
 * Side of one floor square, in metres: a tenth of a metre, rounded to
 * something a student can count. The grid is the only scale on the stage, so
 * it has to be a number, not a convenience.
 */
export const GRID_CELL = 0.1;

/**
 * Where the grid is drawn so that it appears to be everywhere.
 *
 * A floor big enough for a robot that never stops driving would be a floor of
 * thousands of lines. Instead a small patch follows the camera, snapped to
 * whole cells: the lines land in exactly the same places they would have, so
 * a moving robot sees a fixed floor rather than one dragged along with it.
 */
export function gridAnchor(center: number, cell: number = GRID_CELL): number {
  return Math.round(center / cell) * cell;
}

// ─── how a velocity is drawn ──────────────────────────────────────────────────

/**
 * How much of the future a velocity arrow shows: one second of it.
 *
 * Picking a time rather than an arbitrary gain gives every arrow on the stage
 * a readable meaning — the arrow is where that part of the robot gets to in a
 * second — and puts v, v_l and v_r on one scale, which is what makes v the
 * average of the other two by eye as well as by formula.
 */
export const VELOCITY_SECONDS = 1;

export function velocityArrowLength(speed: number): number {
  return speed * VELOCITY_SECONDS;
}

// ─── the printed drawing ──────────────────────────────────────────────────────

export interface Viewport {
  width: number;
  height: number;
}

/**
 * World metres to SVG user units, for the printed stand-in.
 *
 * A top view is orthographic, so this is the whole projection: one scale for
 * both axes — anything else would stretch the robot and make `d` measured off
 * the page disagree with `d` measured off the grid — and a flip, because SVG
 * counts y downwards while the plane counts it up.
 */
export function worldToSvg(
  [x, y]: [number, number],
  viewport: Viewport,
  halfExtent: number,
): [number, number] {
  const scale = svgScale(viewport, halfExtent);
  return [viewport.width / 2 + x * scale, viewport.height / 2 - y * scale];
}

/**
 * Metres to SVG user units.
 *
 * Exported because a length is not a point: the radius of the shell has to be
 * scaled, not projected, and computing it by subtracting two projected points
 * only works while the drawing happens to be centred on the world origin.
 */
export function svgScale(viewport: Viewport, halfExtent: number): number {
  return Math.min(viewport.width, viewport.height) / (2 * halfExtent);
}

// ─── readout ──────────────────────────────────────────────────────────────────

/**
 * A number as the panel writes it: fixed decimals, and never "-0.00", which
 * is what `toFixed` produces for the small negative values a slider lands on
 * around zero.
 */
export function format(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  return /^-0(\.0+)?$/.test(fixed) ? fixed.slice(1) : fixed;
}
