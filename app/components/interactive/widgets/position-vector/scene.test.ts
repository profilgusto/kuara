/**
 * scene.test.ts — the geometry behind the position-vector widget.
 *
 * The parts worth pinning down are the ones a browser would only reveal by
 * eye: that the sliders can never drive the point off its own graduation,
 * that the arrow aiming maths is a real rotation (including the two cases
 * where the shortest-arc formula degenerates), and that the readout writes the
 * same numbers the scene draws.
 */
import { describe, it, expect } from "vitest";
import type { Vec3 } from "../../props";
import {
  AXIS_LENGTH,
  GRID_DIVISIONS,
  GRID_SIZE,
  MAX_DISTANCE,
  MIN_DISTANCE,
  RANGE,
  SLIDER_MAX,
  SLIDER_MIN,
  VIEW_CAMERA,
  arrowQuaternion,
  axisLabelAnchor,
  basisExpansion,
  clampToRange,
  clampVector,
  formatComponent,
  gridTicks,
  isDrawableVector,
  labelAnchor,
  sliderAxes,
  vectorComponents,
  type Quaternion,
} from "./scene";
import { DIMENSIONS, type Dimension } from "../../dimensions";
import { project } from "../../projection";

/**
 * Rotate `v` by the quaternion, the long way round (q · v · q⁻¹ expanded).
 * Lives in the test rather than in `scene.ts` because the widget itself never
 * needs it — three.js applies the quaternion — but checking the aiming maths
 * without it would only re-derive the formula under test.
 */
function rotate(q: Quaternion, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  // t = 2 * (q_vec × v)
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

function normalized(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

describe("the graduated world", () => {
  it("gives the sliders exactly the range the grid covers", () => {
    // A point the student can dial past the edge of the graduation is a point
    // they can no longer read off anything.
    expect(SLIDER_MIN).toBe(-RANGE);
    expect(SLIDER_MAX).toBe(RANGE);
    expect(GRID_SIZE).toBe(2 * RANGE);
  });

  it("rules one square per basis vector", () => {
    expect(GRID_SIZE / GRID_DIVISIONS).toBe(AXIS_LENGTH);
  });

  it("ticks every unit from one end to the other, origin included", () => {
    const ticks = gridTicks();
    expect(ticks[0]).toBe(-RANGE);
    expect(ticks[ticks.length - 1]).toBe(RANGE);
    expect(ticks).toContain(0);
    expect(ticks).toHaveLength(2 * RANGE + 1);
  });

  it("keeps the whole world inside the zoom limits", () => {
    // Zoomed all the way out, the far corner of the grid must still be nearer
    // than the camera may retreat; zoomed all the way in, the student must not
    // end up inside the graduation.
    expect(MAX_DISTANCE).toBeGreaterThan(Math.hypot(RANGE, RANGE));
    expect(MIN_DISTANCE).toBeGreaterThan(0);
    expect(MIN_DISTANCE).toBeLessThan(MAX_DISTANCE);
  });
});

describe("clampToRange", () => {
  it("passes values already inside the range", () => {
    expect(clampToRange(0)).toBe(0);
    expect(clampToRange(2.5)).toBe(2.5);
    expect(clampToRange(-5)).toBe(-5);
  });

  it("pulls an authored point back onto the grid", () => {
    expect(clampToRange(9)).toBe(RANGE);
    expect(clampToRange(-12.7)).toBe(-RANGE);
  });

  it("turns unusable numbers into the origin, not NaN", () => {
    // NaN would poison the arrow's direction and blank the whole scene.
    expect(clampToRange(NaN)).toBe(0);
    expect(clampToRange(Infinity)).toBe(RANGE);
  });

  it("clamps every component of a vector", () => {
    expect(clampVector([9, -9, 1])).toEqual([RANGE, -RANGE, 1]);
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
    ["-z", [0, 0, -1]],
    ["a general direction", [3, 2, 1]],
    ["a general direction with negatives", [-1.5, -4, 2.5]],
  ])("aims +y along %s", (_name, dir) => {
    const rotated = rotate(arrowQuaternion(dir), UP);
    const expected = normalized(dir);
    expect(rotated[0]).toBeCloseTo(expected[0], 10);
    expect(rotated[1]).toBeCloseTo(expected[1], 10);
    expect(rotated[2]).toBeCloseTo(expected[2], 10);
  });

  it("aims straight down, where the shortest arc is undefined", () => {
    // ŷ × (-ŷ) is the zero axis and w collapses to 0: without the special
    // case the quaternion is unnormalisable and the arrow disappears.
    const rotated = rotate(arrowQuaternion([0, -3, 0]), UP);
    expect(rotated[0]).toBeCloseTo(0, 10);
    expect(rotated[1]).toBeCloseTo(-1, 10);
    expect(rotated[2]).toBeCloseTo(0, 10);
  });

  it.each<Vec3>([
    [1, 0, 0],
    [0, -1, 0],
    [3, 2, 1],
  ])("returns a unit quaternion for %j", (...dir) => {
    const q = arrowQuaternion(dir as unknown as Vec3);
    expect(Math.hypot(q[0], q[1], q[2], q[3])).toBeCloseTo(1, 12);
  });
});

describe("isDrawableVector", () => {
  it("rejects the origin, whose direction is meaningless", () => {
    expect(isDrawableVector([0, 0, 0])).toBe(false);
    expect(isDrawableVector([1e-6, 0, 0])).toBe(false);
  });

  it("accepts anything the sliders can actually reach", () => {
    // The finest step the schema allows is 0.1.
    expect(isDrawableVector([0.1, 0, 0])).toBe(true);
    expect(isDrawableVector([0, 0, -5])).toBe(true);
  });
});

describe("formatComponent", () => {
  it("keeps whole numbers whole", () => {
    expect(formatComponent(3)).toBe("3");
    expect(formatComponent(-5)).toBe("-5");
  });

  it("gives everything else exactly one decimal", () => {
    // A column that changed width as the student dragged would jitter.
    expect(formatComponent(2.5)).toBe("2.5");
    expect(formatComponent(-0.25)).toBe("-0.3");
  });

  it("never writes a negative zero", () => {
    expect(formatComponent(-0)).toBe("0");
  });
});

describe("the readout", () => {
  const point: Vec3 = [3, 2.5, -1];

  it.each(DIMENSIONS)("%s: shows one component per visible axis", (dim) => {
    const n = sliderAxes(dim).length;
    expect(vectorComponents(point, dim)).toHaveLength(n);
    expect(basisExpansion(point, dim)).toHaveLength(n);
  });

  it("writes the components as the column vector of the text", () => {
    expect(vectorComponents(point, "3d")).toEqual(["3", "2.5", "-1"]);
    expect(vectorComponents(point, "2d")).toEqual(["3", "2.5"]);
    expect(vectorComponents(point, "1d")).toEqual(["3"]);
  });

  it("expands over the basis vectors, keeping the zero terms", () => {
    // The point of the line is that the vector is a combination of *every*
    // basis vector; a term winking out at 0 teaches the opposite.
    expect(basisExpansion([1, 0, 2], "3d")).toEqual(["1 x̂", "0 ŷ", "2 ẑ"]);
  });
});

describe("label placement", () => {
  it.each(DIMENSIONS)("%s: keeps the point's label off its marker", (dim) => {
    const at: Vec3 = [1, 2, 3];
    const label = labelAnchor(at, dim);
    const gap = Math.hypot(
      label[0] - at[0],
      label[1] - at[1],
      label[2] - at[2],
    );
    expect(gap).toBeGreaterThan(0.16); // the sphere's radius
  });

  it.each(DIMENSIONS)("%s: pushes the label along screen-up", (dim) => {
    const up = VIEW_CAMERA[dim].up;
    const label = labelAnchor([0, 0, 0], dim, 1);
    expect(label).toEqual(up);
  });

  it("hangs the 1D axis label below the ruler, clear of the point", () => {
    // In 1D the point and its label live above the line; x̂ must not join them.
    const [, , z] = axisLabelAnchor("x", "1d");
    expect(z).toBeLessThan(0);
  });

  it.each(["2d", "3d"] as Dimension[])(
    "%s: puts each axis label past its own arrow tip",
    (dim) => {
      for (const axis of sliderAxes(dim)) {
        const anchor = axisLabelAnchor(axis, dim);
        expect(Math.hypot(...anchor)).toBeGreaterThan(AXIS_LENGTH);
      }
    },
  );
});

describe("the cameras", () => {
  const standoff = (dim: Dimension) => {
    const { position, target } = VIEW_CAMERA[dim];
    return Math.hypot(
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    );
  };

  it.each(DIMENSIONS)("%s: opens somewhere the student can zoom", (dim) => {
    // Outside the wheel's range the first scroll jumps the scene: the control
    // clamps the distance before it has moved a notch.
    expect(standoff(dim)).toBeGreaterThanOrEqual(MIN_DISTANCE);
    expect(standoff(dim)).toBeLessThanOrEqual(MAX_DISTANCE);
  });

  it.each(["1d", "2d"] as Dimension[])(
    "%s: stands far enough back to hold the whole graduation",
    (dim) => {
      // Half of a 10-unit world at a 40° vertical fov needs ~13.7 units of
      // standoff; anything nearer crops the graduation the point is read off.
      // The flat views are the ones that promise the whole ruler at a glance.
      expect(standoff(dim)).toBeGreaterThan(
        RANGE / Math.tan((40 * Math.PI) / 360),
      );
    },
  );

  it("opens the 3D view close in, on the frame rather than on the grid", () => {
    // The deliberate exception: 3D trades whole-grid coverage for arrows big
    // enough to read. Measured on the widget's own stage, the drop from the ẑ
    // label to the origin has to cover a real slice of the height — it was a
    // ninth of it from eighteen units out, which is where this started.
    const viewport = { width: 774, height: 270 };
    const camera = VIEW_CAMERA["3d"];
    expect(standoff("3d")).toBeCloseTo(MIN_DISTANCE, 1);

    const origin = project([0, 0, 0], viewport, camera)!;
    const zLabel = project(axisLabelAnchor("z", "3d"), viewport, camera)!;
    expect((origin[1] - zLabel[1]) / viewport.height).toBeGreaterThan(0.15);

    // …and the vector the sliders open on stays whole: tip, label and origin
    // all on the stage, with the tip up and to the right of the origin.
    const tip = project([3, 2, 1], viewport, camera)!;
    const tipLabel = project(labelAnchor([3, 2, 1], "3d"), viewport, camera)!;
    for (const [x, y] of [origin, tip, tipLabel]) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(viewport.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(viewport.height);
    }
    expect(tip[0]).toBeGreaterThan(origin[0]);
    expect(tip[1]).toBeLessThan(origin[1]);

    // The orientation is part of the framing, not a free choice: x̂ runs
    // almost level across the stage and ŷ climbs into the depth, which is
    // what keeps the three arrows from overlapping each other's labels.
    const xLabel = project(axisLabelAnchor("x", "3d"), viewport, camera)!;
    const yLabel = project(axisLabelAnchor("y", "3d"), viewport, camera)!;
    const run = xLabel[0] - origin[0];
    expect(run).toBeGreaterThan(0);
    expect(Math.abs(xLabel[1] - origin[1]) / run).toBeLessThan(0.35);
    expect(origin[1] - yLabel[1]).toBeGreaterThan(Math.abs(run) / 2);
  });

  it("looks along an axis in the flat views, so they read as flat", () => {
    expect(VIEW_CAMERA["1d"].position[0]).toBe(0);
    expect(VIEW_CAMERA["1d"].position[2]).toBe(0);
    expect(VIEW_CAMERA["2d"].position[0]).toBe(0);
    expect(VIEW_CAMERA["2d"].position[1]).toBe(0);
    // Looking down z with z up is degenerate: the 2D view takes +y as up.
    expect(VIEW_CAMERA["2d"].up).toEqual([0, 1, 0]);
  });
});
