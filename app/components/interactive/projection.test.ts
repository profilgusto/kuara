/**
 * projection.test.ts — the geometry behind the printed fallback.
 *
 * The SVG drawing is only trustworthy if these coordinates are, so the cases
 * below pin the properties that make the picture read correctly: what lands in
 * frame, what stays in front of the camera, and which way the axes point.
 */
import { describe, it, expect } from "vitest";
import { AXIS_LENGTH } from "./widgets/coord-frame-3d/views";
import {
  DEFAULT_CAMERA,
  arrowHead,
  normalize,
  project,
  type Camera,
} from "./projection";
import type { Vec3 } from "./props";

const VIEW = { width: 800, height: 400 };
const p = (pt: Vec3, cam?: Camera) => project(pt, VIEW, cam);

describe("normalize", () => {
  it("returns a unit vector", () => {
    const [x, y, z] = normalize([3, 0, 4]);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10);
    expect([x, y, z]).toEqual([0.6, 0, 0.8]);
  });

  it("returns the zero vector rather than NaN for zero length", () => {
    // A NaN here would silently poison every projected coordinate downstream.
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("project", () => {
  it("puts the camera target at the exact centre of the viewport", () => {
    const centre = p(DEFAULT_CAMERA.target)!;
    expect(centre[0]).toBeCloseTo(VIEW.width / 2, 6);
    expect(centre[1]).toBeCloseTo(VIEW.height / 2, 6);
  });

  it("refuses to project a point behind the camera", () => {
    // Twice the camera's distance, on the far side: strictly behind it.
    const behind: Vec3 = [7.8, -9, 6.4];
    expect(p(behind)).toBeNull();
  });

  it("refuses to project a point exactly on the camera plane", () => {
    expect(p(DEFAULT_CAMERA.position)).toBeNull();
  });

  it("leaves room for every axis label inside the viewport", () => {
    // A regression guard for a real defect: with the camera aimed at the
    // origin, the ẑ label sat at y≈8 and printed clipped. The margin is half a
    // line of the 17px label type, so the anchor alone being in bounds is not
    // enough.
    const MARGIN = 18;
    // Matches LABEL_DISTANCE in PrintFallback.tsx: just past the arrow tip.
    const d = AXIS_LENGTH + 0.28;
    const anchors: Vec3[] = [
      [d, 0, 0],
      [0, d, 0],
      [0, 0, d],
    ];
    for (const anchor of anchors) {
      const pt = p(anchor);
      expect(pt, JSON.stringify(anchor)).not.toBeNull();
      expect(pt![0], `x of ${anchor}`).toBeGreaterThan(MARGIN);
      expect(pt![0], `x of ${anchor}`).toBeLessThan(VIEW.width - MARGIN);
      expect(pt![1], `y of ${anchor}`).toBeGreaterThan(MARGIN);
      expect(pt![1], `y of ${anchor}`).toBeLessThan(VIEW.height - MARGIN);
    }
  });

  it("draws +z upwards on the page", () => {
    // Robotics convention: z is up. In SVG, up means a smaller y.
    const origin = p([0, 0, 0])!;
    const zTip = p([0, 0, 2])!;
    expect(zTip[1]).toBeLessThan(origin[1]);
  });

  it("separates the x and y axes horizontally", () => {
    const xTip = p([2, 0, 0])!;
    const yTip = p([0, 2, 0])!;
    // From the default vantage point x falls to the right of y.
    expect(xTip[0]).toBeGreaterThan(yTip[0]);
  });

  it("shrinks a segment as it recedes from the camera", () => {
    // Perspective, not an orthographic projection: the far half of an axis
    // must occupy less of the page than the near half.
    const near = p([0, -1, 0])!;
    const origin = p([0, 0, 0])!;
    const far = p([0, 1, 0])!;
    const nearSpan = Math.hypot(near[0] - origin[0], near[1] - origin[1]);
    const farSpan = Math.hypot(far[0] - origin[0], far[1] - origin[1]);
    expect(nearSpan).toBeGreaterThan(farSpan);
  });

  it("scales with the viewport instead of assuming one size", () => {
    const small = project([0, 0, 2], { width: 400, height: 200 })!;
    const big = project([0, 0, 2], { width: 800, height: 400 })!;
    expect(big[0]).toBeCloseTo(small[0] * 2, 6);
    expect(big[1]).toBeCloseTo(small[1] * 2, 6);
  });

  it("widens the view when the field of view grows", () => {
    const narrow = p([0, 0, 2], { ...DEFAULT_CAMERA, fov: 20 })!;
    const wide = p([0, 0, 2], { ...DEFAULT_CAMERA, fov: 60 })!;
    const centre = VIEW.height / 2;
    // A wider lens pulls the same point back towards the centre.
    expect(Math.abs(wide[1] - centre)).toBeLessThan(
      Math.abs(narrow[1] - centre),
    );
  });
});

describe("arrowHead", () => {
  it("places both corners behind the tip, straddling the shaft", () => {
    const [a, b] = arrowHead([0, 0], [100, 0], 10);
    expect(a[0]).toBeCloseTo(90, 6);
    expect(b[0]).toBeCloseTo(90, 6);
    expect(a[1]).toBeCloseTo(4.2, 6);
    expect(b[1]).toBeCloseTo(-4.2, 6);
  });

  it("keeps the head the same size however long the shaft is", () => {
    const short = arrowHead([0, 0], [20, 0], 10);
    const long = arrowHead([0, 0], [500, 0], 10);
    const width = (h: ReturnType<typeof arrowHead>) =>
      Math.hypot(h[0][0] - h[1][0], h[0][1] - h[1][1]);
    expect(width(short)).toBeCloseTo(width(long), 6);
  });

  it("rotates with the shaft", () => {
    const [a, b] = arrowHead([0, 0], [0, 100], 10);
    // Pointing down the page, the corners separate horizontally instead.
    expect(a[1]).toBeCloseTo(90, 6);
    expect(Math.abs(a[0] - b[0])).toBeCloseTo(8.4, 6);
  });

  it("degenerates safely when there is no direction to point in", () => {
    expect(arrowHead([5, 5], [5, 5])).toEqual([
      [5, 5],
      [5, 5],
    ]);
  });
});
