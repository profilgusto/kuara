/**
 * transform.test.ts — the maths the `homogeneous-transform` widget teaches.
 *
 * These are lesson-level invariants, not implementation details: a 4×4 whose
 * last column is not ᴵp_R, or one that translates a point before rotating it,
 * would render perfectly and teach the wrong thing. The rotation block itself
 * is covered by the suite beside `components/interactive/rotations.ts`; what is checked here is the assembly.
 */
import { describe, it, expect } from "vitest";
import type { Vec3 } from "../../props";
import { elementary, identity, rotationMatrix } from "../../rotations";
import {
  AXIS_LENGTH,
  POSITION_MAX,
  POSITION_MIN,
  applyTransform,
  arrowQuaternion,
  axisLabelAnchor,
  blockOf,
  clampCoord,
  clampPosition,
  formatCoord,
  formatMatrix4,
  homogeneous,
  isDrawableTranslation,
  rotatedAxisTip,
  rotationBlock,
  transformQuaternion,
  translationBlock,
  translationLabelAnchor,
} from "./transform";

const close = (a: number, b: number, digits = 10) =>
  expect(a).toBeCloseTo(b, digits);

const closeVec = (a: Vec3, b: Vec3, digits = 10) => {
  for (let i = 0; i < 3; i++)
    expect(a[i], `component ${i}`).toBeCloseTo(b[i], digits);
};

describe("assembling ᴵT_R", () => {
  it("puts the rotation in the top-left 3×3 and the translation in the last column", () => {
    const r = elementary("z", 90);
    const t = homogeneous(r, [1, 2, 3]);

    expect(rotationBlock(t)).toEqual(r);
    expect(translationBlock(t)).toEqual([1, 2, 3]);
  });

  it("always closes with [0 0 0 1] — the pose is rigid by construction", () => {
    const t = homogeneous(
      rotationMatrix([12, -47, 130], "proprio"),
      [-2, 0.5, 1],
    );
    expect(t[3]).toEqual([0, 0, 0, 1]);
  });

  it("is the identity when nothing is rotated and nothing is moved", () => {
    const t = homogeneous(identity(), [0, 0, 0]);
    expect(t).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]);
  });

  it("keeps the two blocks independent: turning does not move, moving does not turn", () => {
    const turned = homogeneous(elementary("x", 40), [1, 1, 1]);
    const moved = homogeneous(elementary("x", 40), [2, 1, 1]);

    // Only the x component of the last column may differ.
    expect(rotationBlock(turned)).toEqual(rotationBlock(moved));
    expect(translationBlock(moved)[0] - translationBlock(turned)[0]).toBe(1);
  });
});

describe("blockOf", () => {
  it("names the three regions the panel draws", () => {
    expect(blockOf(0, 0)).toBe("rotation");
    expect(blockOf(2, 2)).toBe("rotation");
    expect(blockOf(0, 3)).toBe("translation");
    expect(blockOf(2, 3)).toBe("translation");
    // The whole last row is structural, its final 1 included.
    expect(blockOf(3, 0)).toBe("bottom");
    expect(blockOf(3, 3)).toBe("bottom");
  });
});

describe("applying the transform to a point", () => {
  it("rotates first and translates second", () => {
    // Rz(90°) takes x̂ to ŷ; the translation is then added in {I}.
    const t = homogeneous(elementary("z", 90), [1, 0, 0]);
    closeVec(applyTransform(t, [1, 0, 0]), [1, 1, 0]);
  });

  it("maps the origin of {R} onto ᴵp_R", () => {
    const t = homogeneous(
      rotationMatrix([25, 60, -80], "inercial"),
      [0.4, -1.2, 2],
    );
    closeVec(applyTransform(t, [0, 0, 0]), [0.4, -1.2, 2]);
  });

  it("is a pure translation when the rotation is the identity", () => {
    const t = homogeneous(identity(), [1, -2, 0.5]);
    closeVec(applyTransform(t, [3, 3, 3]), [4, 1, 3.5]);
  });

  it("preserves distances — a rigid pose neither stretches nor shears", () => {
    const t = homogeneous(rotationMatrix([33, -12, 95], "proprio"), [1, 2, -1]);
    const a = applyTransform(t, [1, 0, 0]);
    const b = applyTransform(t, [0, 2, 1]);
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    close(d, Math.hypot(1, -2, -1));
  });
});

describe("formatMatrix4", () => {
  it("prints the structural row as bare 0s and a 1, never 0.00", () => {
    const rows = formatMatrix4(homogeneous(identity(), [1, 0, 0]), 2);
    expect(rows[3]).toEqual(["0", "0", "0", "1"]);
  });

  it("gives every measured entry the same number of decimals", () => {
    const rows = formatMatrix4(homogeneous(elementary("z", 30), [1, 0, 0]), 3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        expect(rows[r][c], `entry ${r},${c}`).toMatch(/^-?\d+\.\d{3}$/);
      }
    }
  });

  it("never prints a negative zero", () => {
    // Rz(180°) has entries that round to -0 in every fixed precision.
    const rows = formatMatrix4(
      homogeneous(elementary("z", 180), [0, -0, 0]),
      2,
    );
    expect(rows.flat().some((e) => e.startsWith("-0.00"))).toBe(false);
  });
});

describe("the sliders' range", () => {
  it("clamps a coordinate to the grid the student can read it off", () => {
    expect(clampCoord(9)).toBe(POSITION_MAX);
    expect(clampCoord(-9)).toBe(POSITION_MIN);
    expect(clampCoord(1.5)).toBe(1.5);
  });

  it("reads NaN as the origin rather than propagating it into the scene", () => {
    expect(clampCoord(NaN)).toBe(0);
    expect(clampPosition([NaN, 3, -3])).toEqual([
      0,
      POSITION_MAX,
      POSITION_MIN,
    ]);
  });

  it("formats a component with the panel's precision", () => {
    expect(formatCoord(1, 2)).toBe("1.00");
    expect(formatCoord(-0.004, 2)).toBe("0.00");
  });
});

describe("the scene", () => {
  it("draws no translation arrow when the frames share an origin", () => {
    expect(isDrawableTranslation([0, 0, 0])).toBe(false);
    expect(isDrawableTranslation([0.0001, 0, 0])).toBe(false);
    expect(isDrawableTranslation([0, 0, 0.5])).toBe(true);
  });

  it("places {R}'s axis tips through the same transform as its origin", () => {
    const t = homogeneous(elementary("z", 90), [1, 1, 0]);
    // x̂_R points along +y after the turn, one axis length from o_R.
    closeVec(rotatedAxisTip(t, "x"), [1, 1 + AXIS_LENGTH, 0]);
    closeVec(rotatedAxisTip(t, "z"), [1, 1, AXIS_LENGTH]);
  });

  it("puts an axis label just beyond its tip", () => {
    const anchor = axisLabelAnchor("y", 0.2);
    closeVec(anchor, [0, AXIS_LENGTH + 0.2, 0]);
  });

  it("hangs the translation's name at the middle of its shaft, lifted clear", () => {
    closeVec(translationLabelAnchor([2, 0, 1], 0.1), [1, 0, 0.6]);
  });

  it("reads the orientation back out of the 4×4 as a unit quaternion", () => {
    const r = rotationMatrix([40, -110, 25], "proprio");
    const q = transformQuaternion(homogeneous(r, [1, 2, 3]));
    close(Math.hypot(q[0], q[1], q[2], q[3]), 1);
  });
});

describe("arrowQuaternion", () => {
  const rotate = (
    [qx, qy, qz, qw]: [number, number, number, number],
    v: Vec3,
  ): Vec3 => {
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
  };

  it("swings +Y onto the direction asked for", () => {
    for (const dir of [
      [1, 0, 0],
      [0, 0, 1],
      [-1, 2, -3],
      [0.3, -0.2, 0.1],
    ] as Vec3[]) {
      const len = Math.hypot(dir[0], dir[1], dir[2]);
      const unit: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];
      closeVec(rotate(arrowQuaternion(dir), [0, 1, 0]), unit, 9);
    }
  });

  it("is the identity for +Y itself and a half-turn for -Y", () => {
    expect(arrowQuaternion([0, 3, 0])).toEqual([0, 0, 0, 1]);
    closeVec(rotate(arrowQuaternion([0, -3, 0]), [0, 1, 0]), [0, -1, 0], 9);
  });

  it("leaves a zero-length direction alone instead of returning NaN", () => {
    expect(arrowQuaternion([0, 0, 0])).toEqual([0, 0, 0, 1]);
  });
});
