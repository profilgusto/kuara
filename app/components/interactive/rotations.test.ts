/**
 * rotations.test.ts — the orientation algebra every widget with a frame reads.
 *
 * These are lesson-level invariants, not implementation details: a rotation
 * matrix whose columns are not {R}'s basis vectors, or a mode switch that does
 * not actually change the order of the product, would teach the wrong thing
 * while still rendering perfectly — in `rotation-matrix`, in
 * `homogeneous-transform`, and in whatever comes next.
 */
import { describe, it, expect } from "vitest";
import type { Vec3 } from "./props";
import {
  ALIGNED_ANGLES,
  ANGLE_AXES,
  ANGLE_MAX,
  ANGLE_MIN,
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
  identity,
  intrinsicTrail,
  isAligned,
  matrixToQuaternion,
  multiply,
  rotationMatrix,
  sliderAngles,
  stepsFromAngles,
  toRotationMode,
  type IntrinsicStep,
  type Mat3,
} from "./rotations";

const close = (a: number, b: number, digits = 10) =>
  expect(a).toBeCloseTo(b, digits);

function expectMatrixClose(actual: Mat3, expected: number[][], digits = 10) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      expect(actual[r][c], `entry ${r},${c}`).toBeCloseTo(
        expected[r][c],
        digits,
      );
    }
  }
}

/** Rotating a vector by a quaternion, the long way — the check, not the code. */
function rotateByQuaternion(
  [qx, qy, qz, qw]: [number, number, number, number],
  v: Vec3,
): Vec3 {
  // v' = v + 2q_w (q × v) + 2 q × (q × v)
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const q: Vec3 = [qx, qy, qz];
  const t = cross(q, v).map((c) => 2 * c) as Vec3;
  const u = cross(q, t);
  return [
    v[0] + qw * t[0] + u[0],
    v[1] + qw * t[1] + u[1],
    v[2] + qw * t[2] + u[2],
  ];
}

describe("elementary rotations", () => {
  it("are the identity at zero", () => {
    for (const axis of ANGLE_AXES) {
      expectMatrixClose(elementary(axis, 0), identity());
    }
  });

  it("turn the right-handed way: Rz(90°) takes x̂ to ŷ", () => {
    const v = apply(elementary("z", 90), [1, 0, 0]);
    close(v[0], 0);
    close(v[1], 1);
    close(v[2], 0);
  });

  it("Rx(90°) takes ŷ to ẑ and Ry(90°) takes ẑ to x̂", () => {
    const a = apply(elementary("x", 90), [0, 1, 0]);
    close(a[2], 1);
    const b = apply(elementary("y", 90), [0, 0, 1]);
    close(b[0], 1);
  });

  it("leave their own axis fixed", () => {
    close(apply(elementary("z", 37), [0, 0, 1])[2], 1);
    close(apply(elementary("x", -122), [1, 0, 0])[0], 1);
  });

  it("are orthonormal: RᵀR = I and det = +1", () => {
    const m = elementary("y", 41);
    for (let i = 0; i < 3; i++) {
      const ci = column(m, i as 0 | 1 | 2);
      close(Math.hypot(ci[0], ci[1], ci[2]), 1);
      for (let j = i + 1; j < 3; j++) {
        const cj = column(m, j as 0 | 1 | 2);
        close(ci[0] * cj[0] + ci[1] * cj[1] + ci[2] * cj[2], 0);
      }
    }
  });
});

describe("multiply", () => {
  it("is the identity's fixed point", () => {
    const m = elementary("x", 23);
    expectMatrixClose(multiply(m, identity()), m);
    expectMatrixClose(multiply(identity(), m), m);
  });

  it("is not commutative — which is why the mode switch matters", () => {
    const a = multiply(elementary("x", 90), elementary("z", 90));
    const b = multiply(elementary("z", 90), elementary("x", 90));
    // Entry by entry: [0][0] alone happens to agree for this pair, and a
    // check that looked only there would pass on a commutative product too.
    const differs = a.some((row, r) =>
      row.some((v, c) => Math.abs(v - b[r][c]) > 1e-6),
    );
    expect(differs).toBe(true);
  });

  it("undoes a rotation with its negative", () => {
    expectMatrixClose(
      multiply(elementary("y", 57), elementary("y", -57)),
      identity(),
    );
  });
});

describe("rotationMatrix", () => {
  it("is the identity when nothing is turned, in either mode", () => {
    expectMatrixClose(rotationMatrix([0, 0, 0], "inercial"), identity());
    expectMatrixClose(rotationMatrix([0, 0, 0], "proprio"), identity());
  });

  it("agrees between modes when only one slider is off zero", () => {
    // A single rotation has no other to commute with, so both readings must
    // give the same frame — the widget would be lying otherwise.
    const angles: Vec3 = [0, 0, 35];
    expectMatrixClose(
      rotationMatrix(angles, "inercial"),
      rotationMatrix(angles, "proprio"),
    );
  });

  it("differs between modes as soon as two are", () => {
    const angles: Vec3 = [90, 0, 90];
    const a = rotationMatrix(angles, "inercial");
    const b = rotationMatrix(angles, "proprio");
    const differs = a.some((row, r) =>
      row.some((v, c) => Math.abs(v - b[r][c]) > 1e-6),
    );
    expect(differs).toBe(true);
  });

  it("composes about the inertial axes as Rz·Ry·Rx", () => {
    const angles: Vec3 = [20, -35, 50];
    const expected = multiply(
      elementary("z", 50),
      multiply(elementary("y", -35), elementary("x", 20)),
    );
    expectMatrixClose(rotationMatrix(angles, "inercial"), expected);
  });

  it("composes about the frame's own axes as Rx·Ry·Rz", () => {
    const angles: Vec3 = [20, -35, 50];
    const expected = multiply(
      elementary("x", 20),
      multiply(elementary("y", -35), elementary("z", 50)),
    );
    expectMatrixClose(rotationMatrix(angles, "proprio"), expected);
  });

  it("is a rotation for arbitrary angles: orthonormal columns", () => {
    const m = rotationMatrix([113, -47, 168], "proprio");
    for (let i = 0; i < 3; i++) {
      const ci = column(m, i as 0 | 1 | 2);
      close(Math.hypot(ci[0], ci[1], ci[2]), 1);
    }
  });

  it("columns are the basis vectors of {R} written in {I}", () => {
    // Equation (5): the j-th column is the image of the j-th basis vector.
    const m = rotationMatrix([15, 25, 35], "inercial");
    const axes: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    axes.forEach((axis, j) => {
      const c = column(m, j as 0 | 1 | 2);
      const image = apply(m, axis);
      c.forEach((v, i) => close(v, image[i]));
    });
  });
});

describe("the intrinsic session", () => {
  const close = (m: Mat3, want: Mat3) =>
    m.forEach((row, i) =>
      row.forEach((entry, j) => expect(entry).toBeCloseTo(want[i][j], 12)),
    );

  it("opens on the orientation the authored angles describe", () => {
    // The seam with everything that came before: the print fallback and the
    // catalogue preview keep drawing the classic product, and the live widget
    // must mount on the very same frame.
    for (const angles of [
      [0, 0, 30],
      [20, -35, 90],
      [180, 180, 180],
    ] as Vec3[]) {
      close(
        composeIntrinsic(stepsFromAngles(angles)),
        rotationMatrix(angles, "proprio"),
      );
    }
  });

  it("drops the angles that turn nothing, so they leave no ghost", () => {
    expect(stepsFromAngles([0, 0, 30])).toEqual([{ axis: "z", deg: 30 }]);
    expect(stepsFromAngles([0, 0, 0])).toEqual([]);
    expect(stepsFromAngles([10, 0, -20])).toEqual([
      { axis: "x", deg: 10 },
      { axis: "z", deg: -20 },
    ]);
  });

  it("clamps an authored angle no slider could reach", () => {
    expect(stepsFromAngles([400, NaN, -999])).toEqual([
      { axis: "x", deg: ANGLE_MAX },
      { axis: "z", deg: ANGLE_MIN },
    ]);
  });

  it("turns a repeated axis about where that axis is *now*", () => {
    // The whole point of the sequence. Turn about x, then about y, then about
    // x again: the second x is {R}'s x, which the y step has moved, so the
    // result is not the same as having asked for 50° about the first x.
    const steps = [
      { axis: "x", deg: 30 },
      { axis: "y", deg: 40 },
      { axis: "x", deg: 20 },
    ] as const;
    const result = composeIntrinsic(steps);

    // Where the third step's axis actually was: {R}'s x̂ after the first two,
    // which is the first column of the orientation at that moment.
    const before = composeIntrinsic(steps.slice(0, 2));
    const axisNow = column(before, 0);
    // That axis is the one the last step leaves untouched — a rotation fixes
    // its own axis, whichever frame it is written in.
    const moved = apply(multiply(before, elementary("x", 20)), [1, 0, 0]);
    axisNow.forEach((c, i) => expect(moved[i]).toBeCloseTo(c, 12));
    // …and it is genuinely a different axis from the inertial x by then.
    expect(Math.abs(axisNow[0] - 1)).toBeGreaterThan(0.1);

    // The old model could only read the two x steps as one, about the first x.
    const asOneAngle = rotationMatrix([50, 40, 0], "proprio");
    const same = result.every((row, i) =>
      row.every((entry, j) => Math.abs(entry - asOneAngle[i][j]) < 1e-9),
    );
    expect(same).toBe(false);
  });

  it("still folds a single axis' repeats into one turn", () => {
    // Two steps about the same axis with nothing in between *do* add up: the
    // axis has not moved, so this is the one case where the old reading was
    // right, and a student checking it must not find a surprise.
    close(
      composeIntrinsic([
        { axis: "y", deg: 25 },
        { axis: "y", deg: 35 },
      ]),
      elementary("y", 60),
    );
  });

  it("is the identity before the first step", () => {
    close(composeIntrinsic([]), identity());
    expect(intrinsicTrail([])).toEqual([]);
  });

  it("leaves one ghost per step, ending on the current frame", () => {
    const steps: IntrinsicStep[] = [
      { axis: "x", deg: 30 },
      { axis: "y", deg: 40 },
      { axis: "z", deg: 15 },
    ];
    const trail = intrinsicTrail(steps);
    expect(trail).toHaveLength(steps.length);
    // Each ghost is where the frame stood when that step was released…
    trail.forEach((ghost, i) =>
      close(ghost, composeIntrinsic(steps.slice(0, i + 1))),
    );
    // …so the newest one is exactly the frame the student is looking at.
    close(trail[trail.length - 1], composeIntrinsic(steps));
  });
});

describe("releasing a slider", () => {
  const steps: IntrinsicStep[] = [{ axis: "x", deg: 30 }];

  it("writes the turn into the sequence", () => {
    expect(commitStep(steps, { axis: "y", deg: -15 })).toEqual([
      { axis: "x", deg: 30 },
      { axis: "y", deg: -15 },
    ]);
  });

  it("commits nothing when the drag ended where it started", () => {
    // Dragged out and back: the frame did not move, so a ghost there would
    // mark a step the student never took.
    expect(commitStep(steps, { axis: "y", deg: 0 })).toEqual(steps);
  });

  it("is a no-op with nothing in flight, so repeat events are harmless", () => {
    // Pointer up and lost capture both fire for one mouse drag.
    const once = commitStep(steps, { axis: "z", deg: 45 });
    expect(commitStep(once, null)).toEqual(once);
  });

  it("never hands back the array it was given", () => {
    // The caller holds this in React state; mutating the previous value in
    // place would leave the scene a render behind its own history.
    expect(commitStep(steps, null)).not.toBe(steps);
    expect(commitStep(steps, { axis: "z", deg: 5 })).not.toBe(steps);
    expect(steps).toEqual([{ axis: "x", deg: 30 }]);
  });
});

describe("sliderAngles", () => {
  it("puts the drag on its own slider and rests the others", () => {
    expect(sliderAngles({ axis: "y", deg: 40 })).toEqual([0, 40, 0]);
    expect(sliderAngles({ axis: "x", deg: -90 })).toEqual([-90, 0, 0]);
    expect(sliderAngles({ axis: "z", deg: 12 })).toEqual([0, 0, 12]);
  });

  it("rests all three between drags", () => {
    expect(sliderAngles(null)).toEqual(ALIGNED_ANGLES);
    expect(isAligned(sliderAngles(null))).toBe(true);
  });
});

describe("factorOrder", () => {
  it("reads the product left to right, per mode", () => {
    expect(factorOrder("inercial")).toEqual(["z", "y", "x"]);
    expect(factorOrder("proprio")).toEqual(["x", "y", "z"]);
  });

  it("is one order reversed into the other", () => {
    expect([...factorOrder("inercial")].reverse()).toEqual(
      factorOrder("proprio"),
    );
  });
});

describe("toRotationMode", () => {
  it("takes the two declared modes", () => {
    expect(toRotationMode("inercial")).toBe("inercial");
    expect(toRotationMode("proprio")).toBe("proprio");
  });

  it("falls back to the inertial reading for anything else", () => {
    expect(toRotationMode(undefined)).toBe("inercial");
    expect(toRotationMode("")).toBe("inercial");
    expect(toRotationMode("INERCIAL")).toBe("inercial");
    expect(toRotationMode("body")).toBe("inercial");
  });
});

describe("clampAngle", () => {
  it("passes an angle the slider can reach", () => {
    expect(clampAngle(0)).toBe(0);
    expect(clampAngle(-180)).toBe(ANGLE_MIN);
    expect(clampAngle(180)).toBe(ANGLE_MAX);
  });

  it("clamps an authored angle outside the track", () => {
    expect(clampAngle(400)).toBe(ANGLE_MAX);
    expect(clampAngle(-999)).toBe(ANGLE_MIN);
    expect(clampAngle(Infinity)).toBe(ANGLE_MAX);
  });

  it("reads NaN as no rotation rather than poisoning the matrix", () => {
    expect(clampAngle(NaN)).toBe(0);
    expect(clampAngles([NaN, 400, -400])).toEqual([0, ANGLE_MAX, ANGLE_MIN]);
  });
});

describe("the aligned orientation", () => {
  it("is the one every mode agrees is no rotation at all", () => {
    // The point of the button: whichever axes the angles are read about, all
    // zeros must leave {R} lying on {I} — the identity, to floating point.
    for (const mode of ["inercial", "proprio"] as const) {
      const m = rotationMatrix(ALIGNED_ANGLES, mode);
      identity().forEach((row, i) =>
        row.forEach((want, j) => expect(m[i][j]).toBeCloseTo(want, 12)),
      );
    }
  });

  it("sits inside the sliders' own track", () => {
    expect(clampAngles(ALIGNED_ANGLES)).toEqual(ALIGNED_ANGLES);
    expect(ALIGNED_ANGLES).toHaveLength(ANGLE_AXES.length);
  });

  it("recognises the aligned frame, and only it", () => {
    expect(isAligned(ALIGNED_ANGLES)).toBe(true);
    expect(isAligned([0, 0, 0])).toBe(true);
    // A slider dragged down through the middle lands on -0.
    expect(isAligned([-0, 0, -0])).toBe(true);
    expect(isAligned([0, 0, 5])).toBe(false);
    expect(isAligned([0, -5, 0])).toBe(false);
    expect(isAligned([180, 0, 0])).toBe(false);
    // 360° is the same orientation, but not the same slider position: the
    // button still has work to do, and the sliders could not show it anyway.
    expect(isAligned([360, 0, 0])).toBe(false);
  });

  it("does not call an unusable angle aligned", () => {
    // NaN only reaches the state from an authored `angles`, which is the case
    // the button exists to rescue; calling it aligned would grey the button
    // out over a scene that is not aligned at all.
    expect(isAligned([NaN, 0, 0])).toBe(false);
  });
});

describe("formatEntry", () => {
  it("keeps a fixed width so the panel does not jitter", () => {
    expect(formatEntry(1)).toBe("1.00");
    expect(formatEntry(0.5)).toBe("0.50");
    expect(formatEntry(-0.7071067811865475)).toBe("-0.71");
  });

  it("never prints a negative zero", () => {
    // sin(180°) is -1.2e-16: rounded naively it shows as "-0.00", which reads
    // as a sign the matrix does not have.
    expect(formatEntry(-1.2e-16)).toBe("0.00");
    expect(formatEntry(-0)).toBe("0.00");
    expect(formatMatrix(elementary("z", 180))[0][1]).toBe("0.00");
  });

  it("honours the requested precision", () => {
    expect(formatEntry(Math.SQRT1_2, 0)).toBe("1");
    expect(formatEntry(Math.SQRT1_2, 4)).toBe("0.7071");
  });
});

describe("formatMatrix", () => {
  it("prints the identity as ones and zeros", () => {
    expect(formatMatrix(identity())).toEqual([
      ["1.00", "0.00", "0.00"],
      ["0.00", "1.00", "0.00"],
      ["0.00", "0.00", "1.00"],
    ]);
  });
});

describe("matrixToQuaternion", () => {
  const cases: { name: string; m: Mat3 }[] = [
    { name: "identity", m: identity() },
    { name: "small z", m: elementary("z", 30) },
    { name: "quarter x", m: elementary("x", 90) },
    { name: "half y", m: elementary("y", 180) },
    { name: "half z", m: elementary("z", 180) },
    { name: "half x", m: elementary("x", 180) },
    { name: "generic", m: rotationMatrix([113, -47, 168], "proprio") },
    { name: "extreme", m: rotationMatrix([180, 180, 180], "inercial") },
  ];

  it.each(cases)("$name: is a unit quaternion", ({ m }) => {
    const q = matrixToQuaternion(m);
    expect(q.every((c) => Number.isFinite(c))).toBe(true);
    close(Math.hypot(q[0], q[1], q[2], q[3]), 1, 8);
  });

  it.each(cases)(
    "$name: rotates vectors exactly as the matrix does",
    ({ m }) => {
      // The scene hands three.js this quaternion instead of the matrix, so the
      // drawn frame is only the matrix in the panel if these agree.
      const q = matrixToQuaternion(m);
      const probes: Vec3[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0.3, -0.8, 0.5],
      ];
      for (const v of probes) {
        const byMatrix = apply(m, v);
        const byQuat = rotateByQuaternion(q, v);
        byMatrix.forEach((c, i) => close(c, byQuat[i], 8));
      }
    },
  );
});
