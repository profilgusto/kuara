/**
 * mapping.test.ts — the algebra behind `frame-mapping`.
 *
 * The widget's whole claim is that the numbers it prints are the ones a
 * student would get by hand, so the anchor of this suite is the worked example
 * from the section's own notes: ᴬp_m = [5, 3]ᵀ, ᴮp_A = [4, -6]ᵀ and
 * ᴮR_A = [[0, -1], [1, 0]] give ᴮp_m = [1, -1]ᵀ. Everything else here guards
 * the two places that example could be reproduced by accident — the transpose
 * and the −ᴮR_A·ᴬp_B — plus the edges the sliders can actually reach.
 */
import { describe, it, expect } from "vitest";
import type { Vec3 } from "../../props";
import {
  RANGE,
  add,
  angleAxes,
  axisCount,
  arrowQuaternion,
  clampCoord,
  clampVector,
  flatten,
  frameLabelAnchor,
  invertPose,
  isDrawable,
  mapPoint,
  matrixEntries,
  vectorLabelAnchor,
  negate,
  poseOf,
  rotatedTerm,
  targetAxisTip,
  toView,
  transpose,
  unmapPoint,
  vectorEntries,
  viewAxes,
  type Mat3,
} from "./mapping";

/** The pose the section's own worked example is drawn from. */
const EXAMPLE_ANGLES: Vec3 = [0, 0, -90];
const EXAMPLE_POSITION: Vec3 = [6, 4, 0];
const EXAMPLE_POINT: Vec3 = [5, 3, 0];

const closeVec = (got: Vec3, want: Vec3, digits = 9) =>
  got.forEach((c, i) => expect(c).toBeCloseTo(want[i], digits));

const closeMat = (got: Mat3, want: Mat3, digits = 9) =>
  got.forEach((row, r) =>
    row.forEach((v, c) => expect(v).toBeCloseTo(want[r][c], digits)),
  );

describe("the worked example from the notes", () => {
  const rd = poseOf(EXAMPLE_ANGLES, EXAMPLE_POSITION);
  const dr = invertPose(rd);

  it("turns {B} a quarter turn clockwise from {A}", () => {
    // ᴬR_B = R_z(-90°): {B}'s x̂ points along -ŷ of {A}, its ŷ along +x̂.
    closeMat(rd.rotation, [
      [0, 1, 0],
      [-1, 0, 0],
      [0, 0, 1],
    ]);
  });

  it("reads ᴮR_A as the transpose", () => {
    closeMat(dr.rotation, [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ]);
  });

  it("reads ᴮp_A as [4, -6]ᵀ", () => {
    // Not −ᴬp_B = [-6, -4]: the displacement has to be resolved in {B}'s own
    // axes first, and this is the number that catches a missing rotation.
    closeVec(dr.position, [4, -6, 0]);
  });

  it("maps m to [1, -1]ᵀ in {B}", () => {
    closeVec(rotatedTerm(dr, EXAMPLE_POINT), [-3, 5, 0]);
    closeVec(mapPoint(dr, EXAMPLE_POINT), [1, -1, 0]);
  });

  it("prints the example as the notes write it", () => {
    expect(vectorEntries(EXAMPLE_POINT, "2d", 0)).toEqual(["5", "3"]);
    expect(vectorEntries(dr.position, "2d", 0)).toEqual(["4", "-6"]);
    expect(matrixEntries(dr.rotation, "2d", 0)).toEqual([
      ["0", "-1"],
      ["1", "0"],
    ]);
    expect(vectorEntries(mapPoint(dr, EXAMPLE_POINT), "2d", 0)).toEqual([
      "1",
      "-1",
    ]);
  });
});

describe("invertPose", () => {
  it("is its own inverse", () => {
    const pose = poseOf([25, -40, 110], [2.5, -3, 1.5]);
    const back = invertPose(invertPose(pose));
    closeMat(back.rotation, pose.rotation);
    closeVec(back.position, pose.position);
  });

  it("leaves a pure translation's rotation alone and only flips its sign", () => {
    const { rotation, position } = invertPose(poseOf([0, 0, 0], [3, -2, 1]));
    closeMat(rotation, [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    closeVec(position, [-3, 2, -1]);
  });

  it("leaves a pure rotation's origin at the origin", () => {
    // Frames sharing an origin: ᴮp_A is zero however {B} is turned, so the
    // mapping is the rotation alone.
    const { position } = invertPose(poseOf([10, 20, 30], [0, 0, 0]));
    closeVec(position, [0, 0, 0]);
  });

  it("never hands the formatter a negative zero", () => {
    // −0 survives arithmetic and prints as "-0.0", which reads to a student
    // as a quantity with a sign.
    const { position } = invertPose(poseOf([0, 0, 0], [0, 5, 0]));
    expect(Object.is(position[0], -0)).toBe(false);
    expect(Object.is(position[2], -0)).toBe(false);
  });
});

describe("mapPoint", () => {
  it("sends {A}'s own origin to ᴮp_A", () => {
    const dr = invertPose(poseOf([0, 0, 35], [1, 2, 3]));
    closeVec(mapPoint(dr, [0, 0, 0]), dr.position);
  });

  it("sends {B}'s origin to zero", () => {
    const rd = poseOf([15, -25, 60], [2, -1, 1.5]);
    closeVec(mapPoint(invertPose(rd), rd.position), [0, 0, 0]);
  });

  it("round-trips through unmapPoint", () => {
    const dr = invertPose(poseOf([12, 48, -70], [-2, 3, 1]));
    const point: Vec3 = [4, -1.5, 2];
    closeVec(unmapPoint(dr, mapPoint(dr, point)), point);
  });

  it("preserves the distance from the point to {B}'s origin", () => {
    // A rigid mapping cannot stretch anything: |ᴮp_m| is how far m is from
    // o_B whichever frame the pair is written in.
    const rd = poseOf([30, 0, 45], [3, -2, 1]);
    const point: Vec3 = [1, 5, -2];
    const mapped = mapPoint(invertPose(rd), point);
    const gap = add(point, negate(rd.position));
    expect(Math.hypot(...mapped)).toBeCloseTo(Math.hypot(...gap), 9);
  });
});

describe("transpose", () => {
  it("swaps rows and columns", () => {
    expect(
      transpose([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]),
    ).toEqual([
      [1, 4, 7],
      [2, 5, 8],
      [3, 6, 9],
    ]);
  });
});

describe("the reachable world", () => {
  it("clamps to the graduation the grid draws", () => {
    expect(clampCoord(RANGE + 4)).toBe(RANGE);
    expect(clampCoord(-RANGE - 4)).toBe(-RANGE);
    expect(clampCoord(2.5)).toBe(2.5);
  });

  it("reads NaN as the origin rather than propagating it", () => {
    expect(clampCoord(NaN)).toBe(0);
    expect(clampVector([NaN, 20, -20])).toEqual([0, RANGE, -RANGE]);
  });

  it("clamps an infinity to the end of its own track", () => {
    expect(clampCoord(Infinity)).toBe(RANGE);
    expect(clampCoord(-Infinity)).toBe(-RANGE);
  });
});

describe("the two views", () => {
  it("falls back to the space, which is the view the block opens on", () => {
    expect(toView(undefined)).toBe("3d");
    expect(toView("1d")).toBe("3d");
    expect(toView("3d")).toBe("3d");
    expect(toView("2d")).toBe("2d");
  });

  it("offers only the rotation the plane actually has", () => {
    expect(angleAxes("2d")).toEqual(["z"]);
    expect(angleAxes("3d")).toEqual(["x", "y", "z"]);
  });

  it("crops vectors and matrices to the view's width", () => {
    expect(axisCount("2d")).toBe(2);
    expect(viewAxes("2d")).toEqual(["x", "y"]);
    expect(vectorEntries([1, 2, 3], "2d", 1)).toEqual(["1.0", "2.0"]);
    expect(vectorEntries([1, 2, 3], "3d", 1)).toEqual(["1.0", "2.0", "3.0"]);
    expect(
      matrixEntries(poseOf([0, 0, 0], [0, 0, 0]).rotation, "2d", 0),
    ).toEqual([
      ["1", "0"],
      ["0", "1"],
    ]);
  });

  it("drops the third coordinate in the plane and keeps it in space", () => {
    expect(flatten([1, 2, 3], "2d")).toEqual([1, 2, 0]);
    expect(flatten([1, 2, 3], "3d")).toEqual([1, 2, 3]);
  });
});

describe("the scene", () => {
  it("puts {B}'s axis tips a unit from its own origin, however it is turned", () => {
    const pose = poseOf([0, 0, -90], [6, 4, 0]);
    // {B}'s x̂ points along -ŷ of {A} after a quarter turn clockwise.
    closeVec(targetAxisTip(pose, "x"), [6, 3, 0]);
    closeVec(targetAxisTip(pose, "y"), [7, 4, 0]);
  });

  it("hangs a label beside its own shaft, at the fraction asked for", () => {
    // Along +x̂, so the in-plane normal is +ŷ and the offset is readable by
    // inspection.
    expect(
      vectorLabelAnchor([0, 0, 0], [4, 0, 0], { at: 0.25, offset: 1 }),
    ).toEqual([1, 1, 0]);
    expect(
      vectorLabelAnchor([0, 0, 0], [4, 0, 0], {
        at: 0.25,
        offset: 1,
        side: -1,
      }),
    ).toEqual([1, -1, 0]);
  });

  it("puts two nearly collinear arrows' labels on opposite sides", () => {
    // The worked example's own arrangement: o_A → m and o_B → o_A run almost
    // along the same line in opposite directions, so the same `side` puts
    // their names either side of it rather than on top of each other.
    const a = vectorLabelAnchor([0, 0, 0], [5, 3, 0], { at: 0.45 });
    const b = vectorLabelAnchor([6, 4, 0], [0, 0, 0], { at: 0.45 });
    const cross =
      (5 * (a[1] - 0) - 3 * (a[0] - 0)) * (5 * (b[1] - 0) - 3 * (b[0] - 0));
    expect(cross).toBeLessThan(0);
  });

  it("still places a label on an arrow standing straight up", () => {
    // No direction in the plane to be normal to: the offset has to fall back
    // to something, or the label lands on the shaft.
    const at = vectorLabelAnchor([1, 1, 0], [1, 1, 3], { offset: 0.5 });
    expect(at).toEqual([1.5, 1, 1.5]);
  });

  it("adds the lift on top of the sideways offset", () => {
    expect(
      vectorLabelAnchor([0, 0, 0], [4, 0, 0], {
        at: 0.5,
        offset: 1,
        lift: 0.3,
      }),
    ).toEqual([2, 1, 0.3]);
  });

  it("pushes each frame's name away from the other frame", () => {
    // The two names must end up on opposite sides of the line joining the
    // origins, leaving the space between them — where m and all three vectors
    // live — clear.
    const r = frameLabelAnchor([0, 0, 0], [6, 0, 0], 1);
    const d = frameLabelAnchor([6, 0, 0], [0, 0, 0], 1);
    expect(r).toEqual([-1, 0, 0]);
    expect(d).toEqual([7, 0, 0]);
  });

  it("falls back to a corner when the two origins coincide", () => {
    // No line to be pushed out along; the name still has to land somewhere.
    const at = frameLabelAnchor([2, 2, 0], [2, 2, 0], 1);
    expect(at[0]).toBeCloseTo(2 - Math.SQRT1_2, 9);
    expect(at[1]).toBeCloseTo(2 - Math.SQRT1_2, 9);
  });

  it("refuses to draw an arrow with no length to point along", () => {
    expect(isDrawable([2, 2, 2], [2, 2, 2])).toBe(false);
    expect(isDrawable([0, 0, 0], [0, 0, 0.5])).toBe(true);
  });

  it("leaves a +Y arrow unrotated and turns the others onto their direction", () => {
    expect(arrowQuaternion([0, 3, 0])).toEqual([0, 0, 0, 1]);
    expect(arrowQuaternion([0, 0, 0])).toEqual([0, 0, 0, 1]);
    // Antiparallel: a half-turn about +x, the branch the general formula
    // cannot reach.
    expect(arrowQuaternion([0, -3, 0])).toEqual([1, 0, 0, 0]);
    // Every quaternion it returns must be a unit one, or three.js scales the
    // arrow it is applied to.
    const q = arrowQuaternion([1, -2, 3]);
    expect(Math.hypot(...q)).toBeCloseTo(1, 12);
  });
});
