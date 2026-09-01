/**
 * differential.test.ts — the model both robot widgets stand on.
 *
 * The claim under test is that the two directions of Eq. (3) are one relation
 * read two ways, and that a robot driven by it moves the way the equation
 * says. So what is pinned down here is: the forward map against the lesson's
 * own formulas, the inverse as an actual inverse in both compositions, the
 * slider ranges being reachable by real motors, and the integration being the
 * exact arc rather than a drifting Euler step.
 */
import { describe, it, expect } from "vitest";
import {
  GRID_CELL,
  ORIGIN_POSE,
  VELOCITY_SECONDS,
  WHEEL_SPEED_MAX,
  advance,
  bodyLimits,
  bodyVelocity,
  clampTwist,
  clampWheels,
  forward,
  format,
  gridAnchor,
  icrDistance,
  inverse,
  robotOutline,
  toWorld,
  quantisePose,
  velocityArrowLength,
  wheelLinearSpeeds,
  wheelOrigin,
  worldToSvg,
  wrapAngle,
  type BodyTwist,
  type Pose,
  type RobotParams,
  type WheelSpeeds,
} from "./differential";

/** The lesson's own platform: 5 cm wheels on a 30 cm track. */
const PARAMS: RobotParams = { r: 0.05, d: 0.3 };

function closeTwist(actual: BodyTwist, expected: BodyTwist, digits = 12) {
  expect(actual.v).toBeCloseTo(expected.v, digits);
  expect(actual.omega).toBeCloseTo(expected.omega, digits);
}

function closeWheels(actual: WheelSpeeds, expected: WheelSpeeds, digits = 12) {
  expect(actual.left).toBeCloseTo(expected.left, digits);
  expect(actual.right).toBeCloseTo(expected.right, digits);
}

describe("the forward relation", () => {
  it("averages the rims for v and differences them for ω", () => {
    // Straight from Eq. (3): v = r(ω_l + ω_r)/2, ω = r(ω_r - ω_l)/d.
    const twist = forward({ left: 4, right: 6 }, PARAMS);
    expect(twist.v).toBeCloseTo((0.05 * 10) / 2, 12);
    expect(twist.omega).toBeCloseTo((0.05 * 2) / 0.3, 12);
  });

  it("turns equal wheel speeds into pure translation", () => {
    closeTwist(forward({ left: 5, right: 5 }, PARAMS), {
      v: 0.25,
      omega: 0,
    });
  });

  it("turns opposite wheel speeds into pure rotation about the axle", () => {
    // The spin on the spot the section promises: the origin was put on the
    // axle precisely so this case has v = 0.
    const twist = forward({ left: -5, right: 5 }, PARAMS);
    expect(twist.v).toBeCloseTo(0, 12);
    expect(twist.omega).toBeCloseTo((0.05 * 10) / 0.3, 12);
  });

  it("turns the robot to its left when the right wheel runs faster", () => {
    // ẑ_R up and ŷ_R left make a positive ω a turn to the left; the sign here
    // is what ties the drawing to the third row of the matrix.
    expect(forward({ left: 1, right: 3 }, PARAMS).omega).toBeGreaterThan(0);
    expect(forward({ left: 3, right: 1 }, PARAMS).omega).toBeLessThan(0);
  });

  it("writes the middle row of the column as an honest zero", () => {
    const column = bodyVelocity({ left: 4, right: 6 }, PARAMS);
    expect(column[1]).toBe(0);
    expect(column[0]).toBeCloseTo(0.25, 12);
  });

  it("gives each wheel the rim speed v = r ω", () => {
    const speeds = wheelLinearSpeeds({ left: 4, right: -6 }, PARAMS);
    expect(speeds.left).toBeCloseTo(0.2, 12);
    expect(speeds.right).toBeCloseTo(-0.3, 12);
  });
});

describe("the inverse relation", () => {
  it("gives each wheel the translation plus or minus half the rotation", () => {
    const wheels = inverse({ v: 0.25, omega: 1 }, PARAMS);
    // v/r = 5, ωd/2r = 3
    closeWheels(wheels, { left: 2, right: 8 });
  });

  it.each<BodyTwist>([
    { v: 0, omega: 0 },
    { v: 0.25, omega: 0 },
    { v: 0, omega: 1.2 },
    { v: -0.13, omega: 0.7 },
    { v: 0.2, omega: -1.4 },
  ])("round-trips %j through the wheels and back", (twist) => {
    closeTwist(forward(inverse(twist, PARAMS), PARAMS), twist, 12);
  });

  it.each<WheelSpeeds>([
    { left: 0, right: 0 },
    { left: 4, right: 6 },
    { left: -7, right: 7 },
    { left: 2.5, right: -1.5 },
  ])("round-trips %j through the chassis and back", (wheels) => {
    closeWheels(inverse(forward(wheels, PARAMS), PARAMS), wheels, 12);
  });

  it("asks for nothing when nothing is wanted", () => {
    closeWheels(inverse({ v: 0, omega: 0 }, PARAMS), { left: 0, right: 0 });
  });
});

describe("what the sliders may ask for", () => {
  it("derives the body limits from what a motor can do", () => {
    const { vMax, omegaMax } = bodyLimits(PARAMS);
    expect(vMax).toBeCloseTo((0.05 * WHEEL_SPEED_MAX) / 2, 12);
    expect(omegaMax).toBeCloseTo((0.05 * WHEEL_SPEED_MAX) / 0.3, 12);
  });

  it("keeps every corner of the inverse mode inside the motors' range", () => {
    // The property the ranges were chosen for: full speed ahead *and* full
    // yaw at once must still be a real pair of wheel speeds. Widen either
    // limit and the widget would silently show motion no motor could produce.
    const { vMax, omegaMax } = bodyLimits(PARAMS);
    for (const v of [-vMax, 0, vMax]) {
      for (const omega of [-omegaMax, 0, omegaMax]) {
        const { left, right } = inverse({ v, omega }, PARAMS);
        expect(Math.abs(left)).toBeLessThanOrEqual(WHEEL_SPEED_MAX + 1e-12);
        expect(Math.abs(right)).toBeLessThanOrEqual(WHEEL_SPEED_MAX + 1e-12);
      }
    }
  });

  it("saturates exactly one wheel at the extreme corner", () => {
    // Not a coincidence worth losing: the budget is split so the corner just
    // touches the limit rather than falling short of it.
    const { vMax, omegaMax } = bodyLimits(PARAMS);
    const { left, right } = inverse({ v: vMax, omega: omegaMax }, PARAMS);
    expect(Math.max(Math.abs(left), Math.abs(right))).toBeCloseTo(
      WHEEL_SPEED_MAX,
      12,
    );
  });

  it("holds a spin-on-the-spot back when the student switches modes", () => {
    // Both motors reversed against each other is a yaw rate the inverse mode
    // cannot express, because there it shares its budget with v.
    const spin = forward(
      { left: -WHEEL_SPEED_MAX, right: WHEEL_SPEED_MAX },
      PARAMS,
    );
    const { omegaMax } = bodyLimits(PARAMS);
    expect(spin.omega).toBeGreaterThan(omegaMax);
    expect(clampTwist(spin, PARAMS).omega).toBeCloseTo(omegaMax, 12);
  });

  it("clamps a wheel to its motor, and reads NaN as a stop", () => {
    closeWheels(clampWheels({ left: 40, right: -40 }), {
      left: WHEEL_SPEED_MAX,
      right: -WHEEL_SPEED_MAX,
    });
    // NaN would propagate into the pose and blank the whole scene.
    expect(clampWheels({ left: NaN, right: 3 }).left).toBe(0);
  });
});

describe("driving the robot", () => {
  it("runs straight ahead when the wheels agree", () => {
    const pose = advance(ORIGIN_POSE, { v: 0.2, omega: 0 }, 2);
    expect(pose.x).toBeCloseTo(0.4, 12);
    expect(pose.y).toBeCloseTo(0, 12);
    expect(pose.theta).toBeCloseTo(0, 12);
  });

  it("runs straight along its own heading, not along x̂_I", () => {
    const start: Pose = { x: 0, y: 0, theta: Math.PI / 2 };
    const pose = advance(start, { v: 0.2, omega: 0 }, 1);
    expect(pose.x).toBeCloseTo(0, 12);
    expect(pose.y).toBeCloseTo(0.2, 12);
  });

  it("turns on the spot without leaving it", () => {
    const pose = advance(ORIGIN_POSE, { v: 0, omega: 1 }, 0.7);
    expect(pose.x).toBeCloseTo(0, 12);
    expect(pose.y).toBeCloseTo(0, 12);
    expect(pose.theta).toBeCloseTo(0.7, 12);
  });

  it("closes a circle exactly, however coarse the steps", () => {
    // The point of integrating the arc in closed form: a circle that did not
    // close would be the odometry drift the lesson discusses later, appearing
    // here as if it were part of the model.
    const twist: BodyTwist = { v: 0.25, omega: 1.25 };
    const period = (2 * Math.PI) / twist.omega;
    for (const steps of [3, 17, 240]) {
      let pose = ORIGIN_POSE;
      for (let i = 0; i < steps; i++) {
        pose = advance(pose, twist, period / steps);
      }
      expect(pose.x).toBeCloseTo(0, 9);
      expect(pose.y).toBeCloseTo(0, 9);
    }
  });

  it("keeps every point of the arc at |v/ω| from the centre of rotation", () => {
    const twist: BodyTwist = { v: 0.2, omega: 0.8 };
    const radius = twist.v / twist.omega;
    // ŷ_R points left, so the centre starts directly to the robot's left.
    const centre = { x: 0, y: radius };
    let pose = ORIGIN_POSE;
    for (let i = 0; i < 40; i++) {
      pose = advance(pose, twist, 0.05);
      expect(Math.hypot(pose.x - centre.x, pose.y - centre.y)).toBeCloseTo(
        Math.abs(radius),
        9,
      );
    }
  });

  it("keeps the heading bounded however long it spins", () => {
    let pose = ORIGIN_POSE;
    for (let i = 0; i < 500; i++) pose = advance(pose, { v: 0, omega: 3 }, 0.1);
    expect(Math.abs(pose.theta)).toBeLessThanOrEqual(Math.PI);
  });

  it("wraps an angle into [-π, π]", () => {
    expect(wrapAngle(0)).toBeCloseTo(0, 12);
    expect(wrapAngle(Math.PI / 2 + 4 * Math.PI)).toBeCloseTo(Math.PI / 2, 12);
    expect(wrapAngle(-0.75 + 6 * Math.PI)).toBeCloseTo(-0.75, 12);
    // Half a turn is the one angle that belongs to either end of the closed
    // interval; which one comes back is float noise, and either is a heading
    // pointing the same way.
    for (const angle of [3 * Math.PI, -3 * Math.PI]) {
      expect(Math.abs(wrapAngle(angle))).toBeCloseTo(Math.PI, 12);
    }
  });
});

describe("server and browser agreeing", () => {
  it("quantises a pose so both engines round it alike", () => {
    // The printed fallback is server-rendered and hydrated: a last-bit
    // disagreement about sin/cos would flip `gridAnchor` at a half-cell
    // boundary and shift the whole floor by a square between the two renders.
    const noisy: Pose = {
      x: 0.45 + 1e-16,
      y: -0.3000000000000004,
      theta: 1.2300000000000002,
    };
    const clean = quantisePose(noisy);
    expect(clean.x).toBe(0.45);
    expect(clean.y).toBe(-0.3);
    expect(clean.theta).toBe(1.23);
  });

  it("snaps a quantised half-cell pose to one definite cell", () => {
    expect(gridAnchor(quantisePose({ x: 0.45, y: 0, theta: 0 }).x)).toBeCloseTo(
      0.5,
      12,
    );
  });

  it("leaves a pose it cannot improve alone", () => {
    expect(quantisePose(ORIGIN_POSE)).toEqual(ORIGIN_POSE);
  });
});

describe("the centre of rotation", () => {
  it("sits at v/ω, to the left for a left turn", () => {
    expect(icrDistance({ v: 0.2, omega: 0.8 })).toBeCloseTo(0.25, 12);
    expect(icrDistance({ v: 0.2, omega: -0.8 })).toBeCloseTo(-0.25, 12);
  });

  it("sits on the axle itself when the robot spins on the spot", () => {
    expect(icrDistance({ v: 0, omega: 1.5 })).toBe(0);
  });

  it("has gone to infinity when the path is straight", () => {
    expect(icrDistance({ v: 0.3, omega: 0 })).toBeNull();
  });
});

describe("how the robot is drawn", () => {
  it("scales the outline from r and d, so the picture matches the sliders", () => {
    const outline = robotOutline(PARAMS);
    expect(outline.wheelLength).toBeCloseTo(2 * PARAMS.r, 12);
    expect(outline.wheelOffset).toBeCloseTo(PARAMS.d / 2, 12);
    // Wheels outside the shell, as in the companion figure — that is what
    // makes `d` a distance the reader can see.
    expect(outline.chassisRadius).toBeLessThan(outline.wheelOffset);
    // Castor behind the axle.
    expect(outline.castorOffset).toBeLessThan(0);
  });

  it("redraws a different robot for different parameters", () => {
    const big = robotOutline({ r: 0.1, d: 0.6 });
    expect(big.wheelLength).toBeCloseTo(0.2, 12);
    expect(big.wheelOffset).toBeCloseTo(0.3, 12);
  });

  it("puts ŷ_R's wheel on the left", () => {
    const outline = robotOutline(PARAMS);
    expect(wheelOrigin("l", outline)[1]).toBeGreaterThan(0);
    expect(wheelOrigin("r", outline)[1]).toBeLessThan(0);
  });

  it("carries a body point into the world through the robot's pose", () => {
    // A quarter turn: the robot's own +x̂_R now points along ŷ_I.
    const pose: Pose = { x: 1, y: 2, theta: Math.PI / 2 };
    const [x, y] = toWorld(pose, 1, 0);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(3, 12);
  });

  it("leaves a point alone at the identity pose", () => {
    expect(toWorld(ORIGIN_POSE, 0.3, -0.2)).toEqual([0.3, -0.2]);
  });
});

describe("the floor", () => {
  it("snaps the grid to whole cells so it reads as fixed", () => {
    // Following the camera unsnapped would drag the floor along with the
    // robot, and the one cue that the robot is moving would be gone.
    expect(gridAnchor(0.34, 0.1)).toBeCloseTo(0.3, 12);
    expect(gridAnchor(-0.36, 0.1)).toBeCloseTo(-0.4, 12);
    expect(gridAnchor(0, 0.1)).toBe(0);
  });

  it("rules the floor in a countable unit", () => {
    expect(GRID_CELL).toBe(0.1);
  });
});

describe("how a velocity is drawn", () => {
  it("draws one second of travel, so v, v_l and v_r share a scale", () => {
    expect(velocityArrowLength(0.25)).toBeCloseTo(0.25 * VELOCITY_SECONDS, 12);
    expect(velocityArrowLength(-0.1)).toBeCloseTo(-0.1 * VELOCITY_SECONDS, 12);
  });
});

describe("the printed drawing", () => {
  const viewport = { width: 800, height: 400 };

  it("puts the world origin at the centre of the page", () => {
    expect(worldToSvg([0, 0], viewport, 1)).toEqual([400, 200]);
  });

  it("counts y upwards, as the plane does and SVG does not", () => {
    const [, up] = worldToSvg([0, 0.5], viewport, 1);
    const [, down] = worldToSvg([0, -0.5], viewport, 1);
    expect(up).toBeLessThan(200);
    expect(down).toBeGreaterThan(200);
  });

  it("scales both axes alike, so the robot is not stretched", () => {
    const [x] = worldToSvg([1, 0], viewport, 2);
    const [, y] = worldToSvg([0, 1], viewport, 2);
    expect(x - 400).toBeCloseTo(200 - y, 12);
  });
});

describe("the readout", () => {
  it("keeps a fixed number of decimals", () => {
    expect(format(0.25, 2)).toBe("0.25");
    expect(format(-1.239, 2)).toBe("-1.24");
    expect(format(3, 1)).toBe("3.0");
  });

  it("never writes a negative zero", () => {
    // Sliders land on -0.001 all the time; "-0.00" reads as a direction.
    expect(format(-0.001, 2)).toBe("0.00");
    expect(format(-0, 2)).toBe("0.00");
  });
});
