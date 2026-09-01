/**
 * The geometry of the `differential-drive` widget, in pure form.
 *
 * This widget replaces the static figure that opened "O robô diferencial": a
 * translucent chassis the student can turn over, with every symbol the module
 * goes on to use written on the thing it measures — the frame {R} on the axle
 * midpoint, r and d on the geometry they measure, each wheel's angular speed
 * ω and the linear speed v it produces at the wheel, and the chassis
 * velocities ẋ_R, ẏ_R, θ̇_R along the axes they are expressed in.
 *
 * Two conventions are load-bearing and both are fixed here rather than in the
 * component, because the lesson's equations depend on them:
 *
 *   - **The frame origin is the midpoint of the wheel axle**, not the centre
 *     of the body shell. That is the "centro de rotação do chassi" the text
 *     defines, and the point the robot turns about when φ̇_l = -φ̇_r.
 *   - **A positive ω is a rotation about +ŷ_R**, which rolls the wheel
 *     forward. Take the wheel's angular velocity as ω ŷ and the
 *     contact-to-centre offset as r ẑ, and the centre's velocity is
 *     ω ŷ × r ẑ = r ω x̂ — the v = r ω the module uses for each wheel, drawn
 *     here as the v_l and v_r arrows, with the same sign for both. Reverse it
 *     on one wheel and the chassis' yaw comes out backwards.
 *
 * Everything the scene stands on is a number in this module — no three.js and
 * no React — so the layout is checkable in Phase 1 and the print fallback can
 * project exactly the same points the WebGL scene draws.
 */
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";

/** Which wheel a piece of geometry belongs to. */
export type Side = "l" | "r";

export const SIDES: Side[] = ["l", "r"];

// ─── proportions ──────────────────────────────────────────────────────────────
//
// World units are arbitrary but internally consistent: `d` really is the
// distance between the two contact points, and `r` really is the wheel's
// radius, so a student who measures the drawing against its own annotations
// gets the right ratio. The shell is drawn narrower than the track on purpose
// — wheels tucked entirely under the body would hide the two dimensions the
// figure exists to show.

/** `d` — distance between the wheels' contact points with the ground. */
export const TRACK = 2.4;

/** `r` — radius of both wheels. The module assumes them equal. */
export const WHEEL_RADIUS = 0.62;

export const WHEEL_WIDTH = 0.18;

export const CHASSIS_RADIUS = 1.05;
export const CHASSIS_HEIGHT = 0.55;

/**
 * The castor that keeps a two-wheeled chassis off its nose.
 *
 * It sits **behind** the axle. Real differential platforms carry it either
 * way, but drawn in front it shares the +x̂_R side with the heading arrows,
 * and a free-swivelling wheel at the head of a robot is easy to misread as
 * the thing that steers it — the one idea this architecture does not use.
 */
export const CASTOR_RADIUS = 0.19;
export const CASTOR_X = -0.72;

/**
 * The ground, in frame coordinates.
 *
 * The frame origin sits on the axle, so the floor is exactly one wheel radius
 * below it — which is also why `r` can be annotated as the drop from a wheel's
 * centre to its contact point without any extra bookkeeping.
 */
export const GROUND_Z = -WHEEL_RADIUS;

/** The basis arrows of {R}. Long enough to clear the shell, no longer. */
export const AXIS_LENGTH = 1.25;

/**
 * The chassis-velocity arrows run along the same directions as the basis
 * arrows and are drawn past their tips: ẋ_R *is* a velocity along x̂_R, and
 * putting it anywhere else would invite the reading that it is a separate
 * direction of its own.
 */
export const VELOCITY_LENGTH = 2.05;

/** Radius of the φ̇ arc drawn around each wheel, as a multiple of `r`. */
export const SPIN_ARC_SCALE = 1.3;

/** Radius of the θ̇_R arc drawn around ẑ_R, and the height it sits at. */
export const YAW_ARC_RADIUS = 0.5;
export const YAW_ARC_Z = 1.02;

/**
 * How far the `d` dimension line is lifted off the floor.
 *
 * It measures a distance between two points *on* the ground, so it belongs on
 * the ground — but drawn exactly there it lies in the same plane as the grid
 * and the two z-fight, breaking the line into a dotted mess that changes with
 * the camera. A hair above the floor is invisible at this scale and settles it.
 */
export const DIMENSION_LIFT = 0.012;

/**
 * How far behind the shell the `d` dimension line is set out.
 *
 * Far enough that neither the line nor its label can be read as touching the
 * wheels: from the three-quarter view the figure opens on, a dimension set out
 * closer projects across the near wheel and stops looking like a measurement
 * of the gap between them.
 */
export const DIMENSION_OFFSET_X = -(CHASSIS_RADIUS + 0.85);

// ─── the parts ────────────────────────────────────────────────────────────────

/**
 * Which way along ŷ_R a wheel lies: +1 for the left one.
 *
 * With x̂_R forward and ẑ_R up, a right-handed frame puts ŷ_R to the robot's
 * left. Getting this backwards mirrors the whole figure and would leave φ̇_l
 * labelling the wheel that the equations call the right one.
 */
export function sideSign(side: Side): 1 | -1 {
  return side === "l" ? 1 : -1;
}

/** Centre of a wheel: on the axle, half a track out. */
export function wheelCenter(side: Side): Vec3 {
  return [0, (sideSign(side) * TRACK) / 2, 0];
}

/** Where a wheel touches the ground — the pair of points `d` is measured between. */
export function contactPoint(side: Side): Vec3 {
  return [0, (sideSign(side) * TRACK) / 2, GROUND_Z];
}

/** Centre of the castor ball. */
export function castorCenter(): Vec3 {
  return [CASTOR_X, 0, GROUND_Z + CASTOR_RADIUS];
}

/** The shell's vertical extent, in frame coordinates. */
export function chassisSpanZ(): [number, number] {
  return [-CHASSIS_HEIGHT / 2, CHASSIS_HEIGHT / 2];
}

// ─── annotations ──────────────────────────────────────────────────────────────

export interface Segment {
  from: Vec3;
  to: Vec3;
}

/**
 * The `r` annotation: a bare line from the wheel's centre out to its rim.
 *
 * It runs **backwards** along -x̂_R, opposite the wheel's velocity arrow, for
 * two reasons. Forwards it would lie under v, and one line carrying two
 * symbols is worse than either alone. Downwards — the more obvious radius —
 * it would land on the `d` dimension's witness line at the contact point, and
 * the two measurements would read as a single bracket.
 *
 * No arrowhead: `r` is a length, not a vector. The head is what tells the
 * reader that v, on the same line the other way, is one.
 */
export function radiusSegment(side: Side): Segment {
  const [, y] = wheelCenter(side);
  return { from: [0, y, 0], to: [-WHEEL_RADIUS, y, 0] };
}

/**
 * `r` is written past the rim rather than over the segment it measures: at
 * mid-length the label lands inside the wheel disc, where neither the letter
 * nor the outline behind it survives.
 */
export function radiusLabelAnchor(side: Side): Vec3 {
  const [, y] = wheelCenter(side);
  return [-(WHEEL_RADIUS + 0.3), y, 0.02];
}

/**
 * How far a wheel's velocity arrow reaches ahead of its centre.
 *
 * Longer than the wheel's own radius on purpose: an arrow that stopped at the
 * rim would be indistinguishable from a second radius, and v is the one
 * quantity here that the reader has to see leaving the wheel.
 */
export const WHEEL_VELOCITY_LENGTH = WHEEL_RADIUS + 0.55;

/**
 * `v_l` and `v_r`: the linear speed each wheel puts down, drawn forward along
 * x̂_R from the wheel's centre.
 *
 * Forward is not a decoration — it is the whole content of v = r ω. Both
 * wheels' arrows point the same way for positive ω, which is what makes the
 * chassis' ẋ_R their average and its θ̇_R their difference.
 */
export function wheelVelocitySegment(side: Side): Segment {
  const [, y] = wheelCenter(side);
  return { from: [0, y, 0], to: [WHEEL_VELOCITY_LENGTH, y, 0] };
}

export function wheelVelocityLabelAnchor(side: Side): Vec3 {
  const [, y] = wheelCenter(side);
  return [WHEEL_VELOCITY_LENGTH + 0.3, y, 0.02];
}

/**
 * The `d` dimension line: set out behind the robot at ground level, with a
 * witness line running to each contact point — the draughting convention, so
 * that what is being measured is unambiguous. Drawn behind because everything
 * in front of the robot is already spoken for by x̂_R and ẋ_R.
 */
export function trackDimension(): {
  line: Segment;
  witness: [Segment, Segment];
} {
  const half = TRACK / 2;
  const x = DIMENSION_OFFSET_X;
  const z = GROUND_Z + DIMENSION_LIFT;
  return {
    line: {
      from: [x, -half, z],
      to: [x, half, z],
    },
    // The witness lines still start at the true contact points: they are what
    // justifies the measurement, and moving them would be a small lie.
    witness: [
      { from: contactPoint("r"), to: [x, -half, z] },
      { from: contactPoint("l"), to: [x, half, z] },
    ],
  };
}

/**
 * `d` is written above its dimension line, not beyond the end of it. Set out
 * further back, the label projects onto the near wheel from the view the
 * figure opens on — the one part of the drawing it must not be read as
 * measuring.
 */
export function trackLabelAnchor(): Vec3 {
  return [DIMENSION_OFFSET_X, 0, GROUND_Z + 0.34];
}

/**
 * Where x̂_R, ŷ_R and ẑ_R are written: just past the tip of each arrow.
 *
 * ŷ_R is dropped slightly below the axis it names. It shares its line with the
 * ẏ_R constraint — which is lifted the same distance above it — and two
 * symbols for one direction, written on the same line, print through each
 * other.
 */
export function axisLabelAnchor(axis: "x" | "y" | "z", offset = 0.34): Vec3 {
  const d = AXIS_LENGTH + offset;
  if (axis === "x") return [d, 0, 0];
  if (axis === "y") return [0, d, -0.24];
  return [0, 0, d];
}

/**
 * Where a chassis-velocity label is written: past the tip of its arrow.
 *
 * The ŷ one is also lifted clear of the plane. ẏ_R runs along ŷ_R and its
 * label would otherwise be written on the same line as ŷ_R's own — two
 * different symbols for the same direction, printed on top of each other.
 */
export function velocityLabelAnchor(axis: "x" | "y", offset = 0.34): Vec3 {
  const d = VELOCITY_LENGTH + offset;
  return axis === "x" ? [d, 0, 0] : [0, d, 0.3];
}

// ─── arcs ─────────────────────────────────────────────────────────────────────

/**
 * Points along a circular arc, in the plane whose normal is `normal`.
 *
 * Used for both rotation symbols in the figure — ω about the axle and θ̇_R
 * about ẑ_R — because a rotation drawn as a straight arrow is the one thing
 * a reader cannot tell apart from a translation.
 */
function arcPoints(
  center: Vec3,
  radius: number,
  normal: "y" | "z",
  from: number,
  to: number,
  samples: number,
): Vec3[] {
  const points: Vec3[] = [];
  const n = Math.max(2, Math.floor(samples));
  for (let i = 0; i < n; i++) {
    const t = from + ((to - from) * i) / (n - 1);
    if (normal === "y") {
      // In the wheel's plane: measured from ẑ towards x̂, so that increasing
      // the angle carries the top of the wheel forwards — the sense of a
      // positive φ̇ (see the header).
      points.push([
        center[0] + radius * Math.sin(t),
        center[1],
        center[2] + radius * Math.cos(t),
      ]);
    } else {
      // About ẑ: the usual x̂-towards-ŷ sense, i.e. a positive θ̇_R.
      points.push([
        center[0] + radius * Math.cos(t),
        center[1] + radius * Math.sin(t),
        center[2],
      ]);
    }
  }
  return points;
}

/** How far the ω arc reaches either side of the top of the wheel. */
const SPIN_ARC_HALF_ANGLE = (62 * Math.PI) / 180;

/**
 * The ω arc for one wheel: over the top of it, from behind to in front, so
 * the arrowhead ends up pointing the way the wheel carries the robot.
 */
export function spinArc(side: Side, samples = 24): Vec3[] {
  return arcPoints(
    wheelCenter(side),
    WHEEL_RADIUS * SPIN_ARC_SCALE,
    "y",
    -SPIN_ARC_HALF_ANGLE,
    SPIN_ARC_HALF_ANGLE,
    samples,
  );
}

export function spinLabelAnchor(side: Side): Vec3 {
  const [, y] = wheelCenter(side);
  return [0, y, WHEEL_RADIUS * SPIN_ARC_SCALE + 0.3];
}

/**
 * The θ̇_R arc is swung round to the back of the robot. Over the front it
 * shares the top of the figure with ω_l, and the two labels — both rotations,
 * both in the same size — printed side by side there invite exactly the
 * confusion between a wheel's spin and the chassis' yaw that the figure is
 * meant to dispel.
 */
const YAW_ARC_FROM = (130 * Math.PI) / 180;
const YAW_ARC_TO = (250 * Math.PI) / 180;

/** The θ̇_R arc: around ẑ_R, high enough up to read as the chassis turning. */
export function yawArc(samples = 28): Vec3[] {
  return arcPoints(
    [0, 0, YAW_ARC_Z],
    YAW_ARC_RADIUS,
    "z",
    YAW_ARC_FROM,
    YAW_ARC_TO,
    samples,
  );
}

export function yawLabelAnchor(): Vec3 {
  const mid = (YAW_ARC_FROM + YAW_ARC_TO) / 2;
  const d = YAW_ARC_RADIUS + 0.34;
  return [d * Math.cos(mid), d * Math.sin(mid), YAW_ARC_Z + 0.12];
}

/**
 * The last step of an arc, as a direction.
 *
 * The arrowhead is a cone that has to be aimed along the curve's tangent;
 * taking it from the final pair of samples keeps the head on the arc however
 * the arc is later re-parametrised.
 */
export function arcTangent(points: Vec3[]): Vec3 {
  if (points.length < 2) return [1, 0, 0];
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
}

// ─── rings, for the printed drawing ───────────────────────────────────────────

/**
 * A closed circle of world points.
 *
 * The live scene builds its shell and wheels from three.js primitives, which
 * the printed page cannot have; the SVG fallback draws the same solids as
 * projected outlines instead. Generating those outlines here — rather than in
 * the fallback — is what keeps the two drawings the same robot.
 */
export function ring(
  center: Vec3,
  radius: number,
  normal: "y" | "z",
  samples = 48,
): Vec3[] {
  const points: Vec3[] = [];
  const n = Math.max(3, Math.floor(samples));
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    if (normal === "y") {
      points.push([
        center[0] + radius * Math.cos(t),
        center[1],
        center[2] + radius * Math.sin(t),
      ]);
    } else {
      points.push([
        center[0] + radius * Math.cos(t),
        center[1] + radius * Math.sin(t),
        center[2],
      ]);
    }
  }
  return points;
}

/** The wheel's silhouette: its rim, in its own plane. */
export function wheelRing(side: Side, samples = 48): Vec3[] {
  return ring(wheelCenter(side), WHEEL_RADIUS, "y", samples);
}

/** The shell's two rims — top and bottom of the cylinder. */
export function chassisRings(samples = 48): [Vec3[], Vec3[]] {
  const [low, high] = chassisSpanZ();
  return [
    ring([0, 0, low], CHASSIS_RADIUS, "z", samples),
    ring([0, 0, high], CHASSIS_RADIUS, "z", samples),
  ];
}

// ─── ground ───────────────────────────────────────────────────────────────────

/**
 * Half-width of the graduated floor the robot stands on. Just wide enough to
 * hold the robot and its longest annotation — a wider floor reads as the
 * subject of the picture rather than as the scale it is there to provide.
 */
export const GROUND_HALF = 3;

/** One square per world unit, so the grid is itself a scale for r and d. */
export const GROUND_STEP = 1;

export function groundTicks(): number[] {
  const ticks: number[] = [];
  for (let t = -GROUND_HALF; t <= GROUND_HALF + 1e-9; t += GROUND_STEP) {
    ticks.push(Number(t.toFixed(4)));
  }
  return ticks;
}

// ─── camera ───────────────────────────────────────────────────────────────────

/**
 * Three-quarter view from the robot's front right, a little above it — the
 * same station point the figure it replaces was drawn from, which is the one
 * that shows both wheels, the track between them and all three axes without
 * any of them collapsing onto another.
 *
 * "Front right" is +x and -y: ŷ_R points left.
 */
export const DEFAULT_VIEW: Camera = {
  position: [4.05, -4.55, 2.95],
  // Aimed above the axle: the shell, the arcs and the ẑ_R arrow all live above
  // the origin, and only the wheels and the `d` line live below it.
  target: [0, 0, 0.25],
  up: [0, 0, 1],
  fov: 38,
};

export const MIN_DISTANCE = 4;
export const MAX_DISTANCE = 18;

/** The hint under the stage. The scene has no controls beyond the camera. */
export const INTERACTION_HINT = "Arraste para girar · role para aproximar";

// ─── arrow orientation ────────────────────────────────────────────────────────

export type Quaternion = [number, number, number, number];

const IDENTITY: Quaternion = [0, 0, 0, 1];

/**
 * The rotation that aims a +Y-oriented cylinder/cone — three.js builds both
 * that way — along `direction`.
 *
 * The same shortest-arc construction `position-vector` and
 * `homogeneous-transform` carry in their own geometry modules; kept local for
 * the same reason they do, so that a widget's scene depends on nothing but its
 * own maths and the shared vocabulary.
 */
export function arrowQuaternion(direction: Vec3): Quaternion {
  const len = Math.hypot(direction[0], direction[1], direction[2]);
  // No direction to align to: leave the primitive as it was built.
  if (len === 0) return IDENTITY;

  const [vx, vy, vz] = [
    direction[0] / len,
    direction[1] / len,
    direction[2] / len,
  ];

  // Already along +Y: the general form below would hand three.js a tuple
  // carrying a -0 component.
  if (vy > 1 - 1e-9) return IDENTITY;

  // Antiparallel: every half-turn about a horizontal axis is a shortest arc,
  // and the formula collapses to the zero quaternion. Pick the one about +x.
  if (vy < -1 + 1e-9) return [1, 0, 0, 0];

  // Shortest arc from +Y: axis = ŷ × v, angle folded into w = 1 + ŷ·v.
  const q: Quaternion = [vz, 0, -vx, 1 + vy];
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
