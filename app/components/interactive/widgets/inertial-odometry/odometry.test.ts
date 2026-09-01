/**
 * odometry.test.ts — turning the velocities into the fixed frame, and summing
 * them into a pose.
 *
 * Two claims carry this widget. The first is that the matrix in the panel and
 * the arrows on the stage are the same operation, so the transform is checked
 * against its own matrix rather than against a second copy of the formula. The
 * second is that what the robot draws is what the sum computes — including the
 * error, which is the point the odometry section closes on: the estimate has
 * to drift *more* with a coarser Δt, and the test says so by measuring it
 * against the closed-form arc the model provides.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_STEPS_PER_FRAME,
  ODOMETRY_START,
  baseHalfExtent,
  elapsedTime,
  fitCentre,
  fitHalfExtent,
  gridCellFor,
  headingArc,
  inertialTwist,
  integrate,
  odometryStep,
  positionMagnitude,
  rotationMatrix,
  toDegrees,
  MAX_GRID_LINES,
  MAX_FIT_GROWTH,
} from "./odometry";
import {
  ORIGIN_POSE,
  advance,
  type BodyTwist,
  type Pose,
} from "../../differential";

/** ᵀR_R applied by hand, so the transform is checked against the matrix. */
function applyMatrix(
  m: ReturnType<typeof rotationMatrix>,
  v: [number, number, number],
): [number, number, number] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

describe("the transform into the fixed frame", () => {
  it("is the identity when the frames are aligned", () => {
    expect(rotationMatrix(0)).toEqual([
      [1, -0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it("turns x̂_R onto ŷ_I at a quarter turn", () => {
    const [x, y] = applyMatrix(rotationMatrix(Math.PI / 2), [1, 0, 0]);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
  });

  it("leaves the yaw rate alone, whatever the heading", () => {
    // Both frames measure it about the same vertical: that bare 1 in the
    // corner of the matrix is the whole content of the third row.
    for (const theta of [0, 0.7, -2.1, 3]) {
      expect(inertialTwist({ v: 0.3, omega: 1.4 }, theta)[2]).toBe(1.4);
    }
  });

  it("agrees with its own matrix, at every heading", () => {
    // The panel prints the matrix and the stage draws the components; if these
    // two ever parted company, the figure would be contradicting its caption.
    const twist: BodyTwist = { v: 0.23, omega: -0.5 };
    for (const theta of [0, 0.3, 1.9, -2.6, Math.PI]) {
      const direct = inertialTwist(twist, theta);
      const viaMatrix = applyMatrix(rotationMatrix(theta), [
        twist.v,
        0,
        twist.omega,
      ]);
      for (let i = 0; i < 3; i++) {
        expect(direct[i]).toBeCloseTo(viaMatrix[i], 12);
      }
    }
  });

  it("splits the speed into components that recompose to it", () => {
    const [dx, dy] = inertialTwist({ v: 0.4, omega: 0 }, 0.9);
    expect(Math.hypot(dx, dy)).toBeCloseTo(0.4, 12);
  });
});

describe("one step of the sum", () => {
  it("moves along the heading held at the start of the step", () => {
    const pose = odometryStep(
      { x: 0, y: 0, theta: Math.PI / 2 },
      { v: 0.2, omega: 0 },
      0.5,
    );
    expect(pose.x).toBeCloseTo(0, 12);
    expect(pose.y).toBeCloseTo(0.1, 12);
  });

  it("holds the heading from the start of the step, not the end of it", () => {
    // ξ(k+1) = ξ(k) + ξ̇(k) Δt: the section evaluates the velocity at k. A
    // quarter turn in one step makes the two readings unmistakable — forward
    // along x̂_I if the heading is taken at the start, along ŷ_I if at the end
    // — and it is the difference between the sum the lesson writes and a
    // different method that happens to look similar.
    const pose = odometryStep(ORIGIN_POSE, { v: 1, omega: Math.PI / 2 }, 1);
    expect(pose.x).toBeCloseTo(1, 12);
    expect(pose.y).toBeCloseTo(0, 12);
    expect(pose.theta).toBeCloseTo(Math.PI / 2, 12);
  });

  it("turns without moving when there is no forward speed", () => {
    const pose = odometryStep(ORIGIN_POSE, { v: 0, omega: 2 }, 0.25);
    expect(pose.x).toBe(0);
    expect(pose.y).toBe(0);
    expect(pose.theta).toBeCloseTo(0.5, 12);
  });

  it("keeps the heading bounded", () => {
    let pose: Pose = ORIGIN_POSE;
    for (let i = 0; i < 400; i++) {
      pose = odometryStep(pose, { v: 0, omega: 3 }, 0.1);
    }
    expect(Math.abs(pose.theta)).toBeLessThanOrEqual(Math.PI);
  });
});

describe("accumulating over frames", () => {
  const twist: BodyTwist = { v: 0.25, omega: 0.6 };

  it("takes whole steps and carries the remainder", () => {
    const state = integrate(ODOMETRY_START, twist, 0.25, 0.1);
    expect(state.steps).toBe(2);
    expect(state.carry).toBeCloseTo(0.05, 12);
  });

  it("reports the time the sum has accounted for", () => {
    const state = integrate(ODOMETRY_START, twist, 1.05, 0.1);
    expect(elapsedTime(state, 0.1)).toBeCloseTo(state.steps * 0.1, 12);
  });

  it("gives the same pose however the seconds arrive", () => {
    // Frame-rate independence: a student on a slow laptop and one on a fast
    // one must read the same odometry off the same second of driving.
    let fine = ODOMETRY_START;
    for (let i = 0; i < 60; i++) fine = integrate(fine, twist, 1 / 60, 0.1);

    let coarse = ODOMETRY_START;
    for (let i = 0; i < 6; i++) coarse = integrate(coarse, twist, 1 / 6, 0.1);

    expect(fine.steps).toBe(coarse.steps);
    expect(fine.pose.x).toBeCloseTo(coarse.pose.x, 12);
    expect(fine.pose.y).toBeCloseTo(coarse.pose.y, 12);
    expect(fine.pose.theta).toBeCloseTo(coarse.pose.theta, 12);
  });

  it("refuses to run away after a backgrounded tab", () => {
    // An hour of unseen time must not become an hour of stepping.
    const state = integrate(ODOMETRY_START, twist, 3600, 0.01);
    expect(state.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(state.carry).toBe(0);
  });

  it("stands still when there is no clock", () => {
    expect(integrate(ODOMETRY_START, twist, 0.5, 0)).toBe(ODOMETRY_START);
    expect(integrate(ODOMETRY_START, twist, -1, 0.1)).toBe(ODOMETRY_START);
    expect(integrate(ODOMETRY_START, twist, NaN, 0.1)).toBe(ODOMETRY_START);
  });

  it("stays put when the wheels are stopped", () => {
    const state = integrate(ODOMETRY_START, { v: 0, omega: 0 }, 2, 0.1);
    expect(state.pose).toEqual(ORIGIN_POSE);
    expect(state.steps).toBe(20);
  });
});

describe("the error the section warns about", () => {
  /** How far the sum lands from where the robot really goes, after `seconds`. */
  function drift(step: number, seconds: number): number {
    const twist: BodyTwist = { v: 0.25, omega: 1 };

    let state = ODOMETRY_START;
    const frames = Math.round(seconds / step);
    for (let i = 0; i < frames; i++)
      state = integrate(state, twist, step, step);

    // The truth: the same motion integrated in closed form.
    const truth = advance(ORIGIN_POSE, twist, elapsedTime(state, step));
    return Math.hypot(state.pose.x - truth.x, state.pose.y - truth.y);
  }

  it("grows with Δt, which is the whole claim of the odometry section", () => {
    const coarse = drift(0.5, 4);
    const medium = drift(0.1, 4);
    const fine = drift(0.01, 4);
    expect(coarse).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(fine);
  });

  it("is big enough at the default step to be worth drawing", () => {
    // Measured, not guessed: a tenth of a second over four seconds of a
    // 1 rad/s turn leaves the estimate a couple of centimetres from the robot,
    // some five per cent of the circle it is running. That is visible on the
    // stage, and it is why the block draws the odometry as its own ghost and
    // its own dashed path instead of pretending the sum and the robot are one
    // object. The bounds are a regression guard on that magnitude.
    const gap = drift(0.1, 4);
    expect(gap).toBeGreaterThan(0.01);
    expect(gap).toBeLessThan(0.05);
  });

  it("vanishes on a straight line, where Euler is exact", () => {
    // No rotation, no curvature to cut across: the sum is not an
    // approximation here, and a student who tries it should see that.
    let state = ODOMETRY_START;
    for (let i = 0; i < 8; i++)
      state = integrate(state, { v: 0.25, omega: 0 }, 0.5, 0.5);
    const truth = advance(ORIGIN_POSE, { v: 0.25, omega: 0 }, 4);
    expect(state.pose.x).toBeCloseTo(truth.x, 12);
    expect(state.pose.y).toBeCloseTo(truth.y, 12);
  });
});

describe("the stage", () => {
  const track = 0.3;
  const base = baseHalfExtent(track);

  it("opens on a floor several robots wide", () => {
    expect(base).toBeGreaterThan(2 * track);
  });

  it("holds still while the robot stays near home", () => {
    expect(fitHalfExtent(base, ORIGIN_POSE)).toBe(base);
    expect(fitHalfExtent(base, { x: 0.1, y: -0.2, theta: 1 })).toBe(base);
  });

  it("zooms out as the robot leaves", () => {
    const far = fitHalfExtent(base, { x: 2, y: 0, theta: 0 });
    expect(far).toBeGreaterThan(base);
  });

  it("keeps the origin and the robot on the stage together", () => {
    // The invariant the whole framing exists for: a pose is measured from
    // somewhere, and both ends of the position vector have to be visible.
    for (const pose of [
      ORIGIN_POSE,
      { x: 0.4, y: -0.2, theta: 1 },
      { x: -1.7, y: 2.3, theta: -2 },
      { x: 3, y: 0, theta: 0 },
    ] as Pose[]) {
      const [cx, cy] = fitCentre(pose);
      const half = fitHalfExtent(base, pose);
      expect(Math.max(Math.abs(cx), Math.abs(cy))).toBeLessThanOrEqual(half);
      expect(
        Math.max(Math.abs(pose.x - cx), Math.abs(pose.y - cy)),
      ).toBeLessThanOrEqual(half);
    }
  });

  it("looks at the origin while the robot is still on it", () => {
    expect(fitCentre(ORIGIN_POSE)).toEqual([0, 0]);
  });

  it("stops growing once the numbers are the thing worth reading", () => {
    expect(fitHalfExtent(base, { x: 1e6, y: 0, theta: 0 })).toBeCloseTo(
      base * MAX_FIT_GROWTH,
      12,
    );
  });

  it("rules the floor in round numbers, and keeps it countable", () => {
    for (const half of [0.3, 0.9, 2.5, 8, 40]) {
      const cell = gridCellFor(half);
      expect((2 * half) / cell).toBeLessThanOrEqual(MAX_GRID_LINES);
      // Round: a scale nobody can read off is not a scale.
      expect([0.05, 0.1, 0.25, 0.5, 1, 2, 5]).toContain(cell);
    }
  });

  it("takes a finer ruling for a smaller stage", () => {
    expect(gridCellFor(0.3)).toBeLessThan(gridCellFor(8));
  });
});

describe("what the figure marks on the robot", () => {
  it("sweeps θ from x̂_I round to the robot's heading", () => {
    // Measured between the frames, so it starts along the fixed axis: an arc
    // that began at the robot would be measuring from the thing measured.
    const pose: Pose = { x: 0.4, y: 0.2, theta: 1 };
    const arc = headingArc(pose, 0.1);
    expect(arc[0][0]).toBeCloseTo(pose.x + 0.1, 12);
    expect(arc[0][1]).toBeCloseTo(pose.y, 12);
    const end = arc[arc.length - 1];
    expect(Math.atan2(end[1] - pose.y, end[0] - pose.x)).toBeCloseTo(1, 12);
  });

  it("keeps every point of the arc at its radius from the robot", () => {
    const pose: Pose = { x: -0.3, y: 0.7, theta: -2 };
    for (const [x, y] of headingArc(pose, 0.12)) {
      expect(Math.hypot(x - pose.x, y - pose.y)).toBeCloseTo(0.12, 12);
    }
  });

  it("measures the position vector from the origin", () => {
    expect(positionMagnitude({ x: 3, y: 4, theta: 0 })).toBeCloseTo(5, 12);
    expect(positionMagnitude(ORIGIN_POSE)).toBe(0);
  });

  it("reports the heading in degrees, which is what a reader pictures", () => {
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 12);
    expect(toDegrees(-Math.PI / 2)).toBeCloseTo(-90, 12);
  });
});
