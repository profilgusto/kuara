/**
 * robot.test.ts — the geometry behind the differential-drive figure.
 *
 * This widget is a labelled drawing, so what is worth pinning down is whether
 * the labels are still telling the truth about the thing they point at: that
 * `d` really spans the two contact points, that `r` really is a wheel radius,
 * that the frame's origin really sits on the axle, and — the one a reader
 * cannot check by eye and the module's equations depend on — that the ω arcs
 * turn the way a positive ω turns a wheel.
 */
import { describe, it, expect } from "vitest";
import type { Vec3 } from "../../props";
import {
  AXIS_LENGTH,
  CHASSIS_RADIUS,
  DEFAULT_VIEW,
  GROUND_HALF,
  GROUND_STEP,
  GROUND_Z,
  MAX_DISTANCE,
  MIN_DISTANCE,
  SIDES,
  TRACK,
  VELOCITY_LENGTH,
  WHEEL_RADIUS,
  WHEEL_VELOCITY_LENGTH,
  arcTangent,
  arrowQuaternion,
  axisLabelAnchor,
  castorCenter,
  chassisRings,
  chassisSpanZ,
  contactPoint,
  groundTicks,
  radiusSegment,
  ring,
  sideSign,
  spinArc,
  trackDimension,
  velocityLabelAnchor,
  wheelCenter,
  wheelRing,
  wheelVelocityLabelAnchor,
  wheelVelocitySegment,
  yawArc,
  type Quaternion,
  type Side,
} from "./robot";

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Rotate `v` by the quaternion — q · v · q⁻¹, expanded. */
function rotate(q: Quaternion, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

const UP: Vec3 = [0, 1, 0];

describe("the frame the module defines", () => {
  it("puts the origin on the axle, one radius above the ground", () => {
    // "origem fixada no centro de rotação do chassi": the point the robot
    // turns about when ω_l = -ω_r, which is the midpoint of the axle — not
    // the centre of the shell, and not a point on the floor.
    expect(GROUND_Z).toBe(-WHEEL_RADIUS);
    for (const side of SIDES) {
      expect(wheelCenter(side)[2]).toBe(0);
      expect(contactPoint(side)[2]).toBe(GROUND_Z);
    }
  });

  it("puts ŷ_R to the robot's left, as a right-handed frame must", () => {
    // x̂ forward and ẑ up leaves ŷ pointing left; mirroring it would hang ω_l
    // on the wheel the equations call the right one.
    expect(sideSign("l")).toBe(1);
    expect(sideSign("r")).toBe(-1);
    expect(wheelCenter("l")[1]).toBeGreaterThan(0);
    expect(wheelCenter("r")[1]).toBeLessThan(0);
  });

  it("centres the axle on the origin", () => {
    const [, yl] = wheelCenter("l");
    const [, yr] = wheelCenter("r");
    expect(yl + yr).toBeCloseTo(0, 12);
  });

  it("writes each basis label past the tip of its own arrow", () => {
    for (const axis of ["x", "y", "z"] as const) {
      const anchor = axisLabelAnchor(axis);
      expect(Math.hypot(...anchor)).toBeGreaterThan(AXIS_LENGTH);
    }
    expect(axisLabelAnchor("x")[0]).toBeGreaterThan(0);
    expect(axisLabelAnchor("y")[1]).toBeGreaterThan(0);
    expect(axisLabelAnchor("z")[2]).toBeGreaterThan(0);
  });

  it("draws the chassis velocities past the basis arrows they run along", () => {
    // ẋ_R is a velocity along x̂_R, so it shares its direction; drawn shorter
    // it would vanish inside the axis arrow.
    expect(VELOCITY_LENGTH).toBeGreaterThan(AXIS_LENGTH);
    expect(velocityLabelAnchor("x")[0]).toBeGreaterThan(VELOCITY_LENGTH);
    expect(velocityLabelAnchor("y")[1]).toBeGreaterThan(VELOCITY_LENGTH);
  });
});

describe("the measurements the figure annotates", () => {
  it("spans exactly d between the two contact points", () => {
    expect(distance(contactPoint("l"), contactPoint("r"))).toBeCloseTo(
      TRACK,
      12,
    );
  });

  it("sets the d dimension line out at ground level, at full length", () => {
    const { line } = trackDimension();
    expect(distance(line.from, line.to)).toBeCloseTo(TRACK, 12);
    // On the floor it measures across, but lifted a hair clear of it: drawn
    // in the grid's own plane the two z-fight and the line breaks up.
    for (const end of [line.from, line.to]) {
      expect(end[2]).toBeGreaterThan(GROUND_Z);
      expect(end[2] - GROUND_Z).toBeLessThan(0.05);
    }
    // Behind the shell, so it cannot be read as a measurement of the body.
    expect(line.from[0]).toBeLessThan(-CHASSIS_RADIUS);
  });

  it("runs a witness line from each contact point to the dimension line", () => {
    const { line, witness } = trackDimension();
    // Each witness starts on the contact point it justifies and ends on its
    // own end of the dimension line — swap them and the drawing claims to
    // measure the diagonal.
    expect(witness[0].from).toEqual(contactPoint("r"));
    expect(witness[1].from).toEqual(contactPoint("l"));
    expect(witness[0].to[1]).toBeCloseTo(line.from[1], 12);
    expect(witness[1].to[1]).toBeCloseTo(line.to[1], 12);
  });

  it("draws r as a true radius, from the wheel's centre to its rim", () => {
    for (const side of SIDES) {
      const seg = radiusSegment(side);
      expect(seg.from).toEqual(wheelCenter(side));
      expect(distance(seg.from, seg.to)).toBeCloseTo(WHEEL_RADIUS, 12);
      // In the wheel's own plane: a radius that wandered off it would be
      // measuring some oblique chord of the tyre.
      expect(seg.to[1]).toBeCloseTo(wheelCenter(side)[1], 12);
    }
  });

  it("keeps r clear of the velocity arrow by running the other way", () => {
    // Both start at the wheel's centre. Sharing a direction would put a length
    // and a vector on one line, and the reader could not tell which the
    // arrowhead belonged to.
    for (const side of SIDES) {
      const r = radiusSegment(side);
      const v = wheelVelocitySegment(side);
      expect(v.from).toEqual(r.from);
      expect(r.to[0] * v.to[0]).toBeLessThan(0);
    }
  });

  it("keeps the wheels outside the shell, where both can be measured", () => {
    for (const side of SIDES) {
      expect(Math.abs(wheelCenter(side)[1])).toBeGreaterThan(CHASSIS_RADIUS);
    }
  });

  it("stands the shell clear of the ground", () => {
    const [low] = chassisSpanZ();
    expect(low).toBeGreaterThan(GROUND_Z);
  });

  it("rests the castor on the ground, behind the axle", () => {
    const c = castorCenter();
    // Behind, not in front: on the +x̂_R side it sits among the heading arrows
    // and reads as a steering wheel, which a differential drive has not got.
    expect(c[0]).toBeLessThan(0);
    // Touching, not floating and not sunk: its centre is its own radius up.
    expect(c[2]).toBeCloseTo(GROUND_Z + 0.19, 12);
  });
});

describe("the wheel velocities", () => {
  it("points v forwards, along x̂_R", () => {
    // v = r ω, and the ω arcs roll the wheels forwards: an arrow pointing any
    // other way would contradict the arc drawn right above it.
    for (const side of SIDES) {
      const v = wheelVelocitySegment(side);
      expect(v.to[0]).toBeGreaterThan(0);
      expect(v.to[1]).toBeCloseTo(wheelCenter(side)[1], 12);
      expect(v.to[2]).toBeCloseTo(0, 12);
    }
  });

  it("reaches past the rim, so v cannot be read as a second radius", () => {
    expect(WHEEL_VELOCITY_LENGTH).toBeGreaterThan(WHEEL_RADIUS);
    for (const side of SIDES) {
      const v = wheelVelocitySegment(side);
      expect(distance(v.from, v.to)).toBeCloseTo(WHEEL_VELOCITY_LENGTH, 12);
      expect(wheelVelocityLabelAnchor(side)[0]).toBeGreaterThan(
        WHEEL_VELOCITY_LENGTH,
      );
    }
  });

  it("gives both wheels the same forward direction", () => {
    // The chassis' ẋ_R is their average and its θ̇_R their difference; drawn
    // opposed, the figure would assert a robot that can only spin.
    const l = wheelVelocitySegment("l").to;
    const r = wheelVelocitySegment("r").to;
    expect(l[0]).toBeCloseTo(r[0], 12);
  });
});

describe("the rotation arrows", () => {
  it.each(SIDES)("keeps the ω arc in wheel %s's own plane", (side: Side) => {
    const y = wheelCenter(side)[1];
    for (const p of spinArc(side)) {
      expect(p[1]).toBeCloseTo(y, 12);
    }
  });

  it.each(SIDES)("holds the ω arc clear of wheel %s's rim", (side: Side) => {
    const center = wheelCenter(side);
    for (const p of spinArc(side)) {
      expect(distance(p, center)).toBeGreaterThan(WHEEL_RADIUS);
    }
  });

  it.each(SIDES)("turns wheel %s the way a positive ω turns it", (side) => {
    // A positive ω is a rotation about +ŷ_R, which carries the top of the
    // wheel forwards: v_centre = ω ŷ × r ẑ = r ω x̂. Drawn the other way the
    // figure would contradict v = r ω — and, on one wheel only, would flip
    // the sign of the chassis' yaw.
    const arc = spinArc(side);
    const start = arc[0];
    const end = arc[arc.length - 1];
    expect(start[0]).toBeLessThan(0); // begins behind the axle
    expect(end[0]).toBeGreaterThan(0); // ends in front of it
    expect(start[2]).toBeGreaterThan(0); // over the top of the wheel
    expect(end[2]).toBeGreaterThan(0);
    // The head, which is what a reader actually reads, points forwards.
    expect(arcTangent(arc)[0]).toBeGreaterThan(0);
  });

  it("turns θ̇_R from x̂_R towards ŷ_R", () => {
    // The positive sense about ẑ_R. The module's ω is this rotation, so an
    // arc drawn the other way would put the student's mental sign at odds
    // with the third row of the kinematic model.
    const arc = yawArc();
    const start = arc[0];
    const end = arc[arc.length - 1];
    // The sense, not the placement: the arc may be swung anywhere round ẑ_R
    // to keep its label out of ω_l's way, but it must always sweep the way
    // the ẑ component of start × end is positive.
    expect(start[0] * end[1] - start[1] * end[0]).toBeGreaterThan(0);
    // …and it must sweep less than a half turn, or the cross product above
    // would report a backwards arc as a forwards one.
    const sweep = Math.abs(
      Math.atan2(end[1], end[0]) - Math.atan2(start[1], start[0]),
    );
    expect(Math.min(sweep, 2 * Math.PI - sweep)).toBeLessThan(Math.PI);
    // Flat: a yaw is a rotation in the plane, and an arc that drifted in z
    // would be drawing some other rotation.
    for (const p of arc) {
      expect(p[2]).toBeCloseTo(start[2], 12);
    }
  });

  it("takes an arc's heading from its last step", () => {
    expect(
      arcTangent([
        [0, 0, 0],
        [2, 0, 0],
      ]),
    ).toEqual([2, 0, 0]);
  });

  it("has a heading to give even for a degenerate arc", () => {
    // A one-point arc would otherwise hand three.js a zero direction, and the
    // arrowhead would disappear rather than merely sit oddly.
    expect(arcTangent([])).toEqual([1, 0, 0]);
    expect(arcTangent([[1, 1, 1]])).toEqual([1, 0, 0]);
  });
});

describe("the outlines the printed drawing is built from", () => {
  it("closes a ring at the requested radius, in the requested plane", () => {
    const r = ring([0, 0, 1], 2, "z", 12);
    expect(r).toHaveLength(12);
    for (const p of r) {
      expect(p[2]).toBe(1);
      expect(Math.hypot(p[0], p[1])).toBeCloseTo(2, 12);
    }
  });

  it("never returns a degenerate ring, however few samples are asked for", () => {
    expect(ring([0, 0, 0], 1, "z", 0).length).toBeGreaterThanOrEqual(3);
  });

  it("draws each wheel as its own rim", () => {
    for (const side of SIDES) {
      const center = wheelCenter(side);
      for (const p of wheelRing(side, 16)) {
        expect(distance(p, center)).toBeCloseTo(WHEEL_RADIUS, 12);
        expect(p[1]).toBeCloseTo(center[1], 12);
      }
    }
  });

  it("draws the shell as its two rims, a body height apart", () => {
    const [low, high] = chassisRings(16);
    const [zLow, zHigh] = chassisSpanZ();
    expect(low[0][2]).toBeCloseTo(zLow, 12);
    expect(high[0][2]).toBeCloseTo(zHigh, 12);
    expect(Math.hypot(low[0][0], low[0][1])).toBeCloseTo(CHASSIS_RADIUS, 12);
  });

  it("graduates the floor one square per unit, symmetric about the origin", () => {
    const ticks = groundTicks();
    expect(ticks[0]).toBe(-GROUND_HALF);
    expect(ticks[ticks.length - 1]).toBe(GROUND_HALF);
    expect(ticks).toContain(0);
    expect(ticks[1] - ticks[0]).toBeCloseTo(GROUND_STEP, 12);
  });

  it("rules a floor wide enough to hold the whole robot", () => {
    expect(GROUND_HALF).toBeGreaterThan(TRACK / 2);
    expect(GROUND_HALF).toBeGreaterThan(VELOCITY_LENGTH);
  });
});

describe("the camera", () => {
  it("stands off the robot's front right, above it", () => {
    // The station point that shows both wheels, the track and all three axes
    // without any of them collapsing onto another. ŷ_R points left, so the
    // robot's right is -y.
    expect(DEFAULT_VIEW.position[0]).toBeGreaterThan(0);
    expect(DEFAULT_VIEW.position[1]).toBeLessThan(0);
    expect(DEFAULT_VIEW.position[2]).toBeGreaterThan(0);
    expect(DEFAULT_VIEW.up).toEqual([0, 0, 1]);
  });

  it("opens inside the range the student may zoom over", () => {
    const d = distance(DEFAULT_VIEW.position, DEFAULT_VIEW.target);
    expect(d).toBeGreaterThanOrEqual(MIN_DISTANCE);
    expect(d).toBeLessThanOrEqual(MAX_DISTANCE);
  });
});

describe("arrowQuaternion", () => {
  it("leaves a +y vector alone", () => {
    expect(arrowQuaternion([0, 3, 0])).toEqual([0, 0, 0, 1]);
  });

  it("has no direction to aim at for the zero vector", () => {
    expect(arrowQuaternion([0, 0, 0])).toEqual([0, 0, 0, 1]);
  });

  it.each<[string, Vec3]>([
    ["+x", [1, 0, 0]],
    ["-x", [-2, 0, 0]],
    ["+z", [0, 0, 4]],
    ["a tangent off the ω arc", [0.4, 0, -0.9]],
  ])("aims +y along %s", (_name, dir) => {
    const rotated = rotate(arrowQuaternion(dir), UP);
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    expect(rotated[0]).toBeCloseTo(dir[0] / len, 10);
    expect(rotated[1]).toBeCloseTo(dir[1] / len, 10);
    expect(rotated[2]).toBeCloseTo(dir[2] / len, 10);
  });

  it("aims straight down, where the shortest arc is undefined", () => {
    const rotated = rotate(arrowQuaternion([0, -3, 0]), UP);
    expect(rotated[0]).toBeCloseTo(0, 10);
    expect(rotated[1]).toBeCloseTo(-1, 10);
    expect(rotated[2]).toBeCloseTo(0, 10);
  });
});
