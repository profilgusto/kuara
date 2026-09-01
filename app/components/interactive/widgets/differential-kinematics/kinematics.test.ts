/**
 * kinematics.test.ts — how the `differential-kinematics` block stages the
 * model.
 *
 * The relation itself is `../../differential`'s, and tested next to it. What
 * is checked here is only what this block decides for itself: how much floor
 * it shows, how far it will draw a rotation before the arc stops reading as
 * one, and when the centre of rotation is close enough to be worth marking.
 */
import { describe, it, expect } from "vitest";
import {
  VELOCITY_SECONDS,
  YAW_ARC_MAX_SWEEP,
  icrIsVisible,
  viewHalfExtent,
  yawArcSweep,
  type RobotParams,
} from "./kinematics";

/** The lesson's own platform: 5 cm wheels on a 30 cm track. */
const PARAMS: RobotParams = { r: 0.05, d: 0.3 };

describe("the stage", () => {
  it("frames a floor several robots wide", () => {
    expect(viewHalfExtent(PARAMS)).toBeGreaterThan(PARAMS.d);
  });

  it("scales the framing with the robot, not with the page", () => {
    // A robot authored twice the size gets twice the floor: the grid is the
    // scale r and d are read against, and it has to stay in proportion.
    expect(viewHalfExtent({ r: 0.1, d: 0.6 })).toBeCloseTo(
      2 * viewHalfExtent(PARAMS),
      12,
    );
  });
});

describe("the yaw arc", () => {
  it("spans the angle the robot turns in the same second the arrows show", () => {
    expect(yawArcSweep(0.5)).toBeCloseTo(0.5 * VELOCITY_SECONDS, 12);
  });

  it("holds short of a full turn", () => {
    // A sweep past 2π draws a closed circle, which reads as no rotation.
    expect(Math.abs(yawArcSweep(50))).toBeLessThanOrEqual(YAW_ARC_MAX_SWEEP);
    expect(yawArcSweep(-50)).toBe(-YAW_ARC_MAX_SWEEP);
  });
});

describe("the centre of rotation", () => {
  it("is only marked while it is near enough to mean anything", () => {
    // Further out the marker is off-stage anyway, and the arc through the
    // robot is indistinguishable from a straight line.
    const half = viewHalfExtent(PARAMS);
    expect(icrIsVisible(0.1, half)).toBe(true);
    expect(icrIsVisible(-0.1, half)).toBe(true);
    expect(icrIsVisible(400, half)).toBe(false);
    expect(icrIsVisible(null, half)).toBe(false);
  });
});
