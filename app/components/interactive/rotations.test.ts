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
  ANGLE_AXES,
  ANGLE_MAX,
  ANGLE_MIN,
  apply,
  clampAngle,
  clampAngles,
  column,
  elementary,
  factorOrder,
  formatEntry,
  formatMatrix,
  identity,
  matrixToQuaternion,
  multiply,
  rotationMatrix,
  toRotationMode,
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
