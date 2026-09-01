/**
 * views.test.ts — the geometry behind the header's 1D/2D/3D switch.
 *
 * Pure module, so every rule the switch enforces is checkable without a
 * browser: which axes a view draws, where the camera stands, and what happens
 * to an authored 3D point when the student flattens the scene.
 */
import { describe, it, expect } from "vitest";
import {
  AXIS_COUNT,
  DIMENSIONS,
  VIEW_CAMERA,
  axisLabelAnchor,
  interactionHint,
  rollUp,
  rotationMode,
  shortestAngleDelta,
  clampPoint,
  formatCoords,
  labelAnchor,
  AXIS_LENGTH,
  GRID_DIVISIONS,
  GRID_HALF,
  GRID_SIZE,
  GRID_STEP,
  referenceKind,
  rulerTicks,
  showsProjections,
  toDimension,
  visibleAxes,
} from "./views";
import { DEFAULT_CAMERA, project } from "../../projection";

describe("toDimension", () => {
  it("accepts the three declared ids", () => {
    expect(toDimension("1d")).toBe("1d");
    expect(toDimension("2d")).toBe("2d");
    expect(toDimension("3d")).toBe("3d");
  });

  it("falls back to 3d when the box sets no variant", () => {
    // The admin thumbnail and any direct import render without the prop.
    expect(toDimension(undefined)).toBe("3d");
  });

  it("falls back to 3d for an id it does not know", () => {
    expect(toDimension("4d")).toBe("3d");
    expect(toDimension("")).toBe("3d");
    expect(toDimension("3D")).toBe("3d");
  });
});

describe("visibleAxes", () => {
  it("builds up x, then xy, then xyz", () => {
    expect(visibleAxes("1d")).toEqual(["x"]);
    expect(visibleAxes("2d")).toEqual(["x", "y"]);
    expect(visibleAxes("3d")).toEqual(["x", "y", "z"]);
  });

  it("agrees with the axis count", () => {
    for (const dim of DIMENSIONS) {
      expect(visibleAxes(dim)).toHaveLength(AXIS_COUNT[dim]);
    }
  });

  it("hands back a fresh array a caller cannot use to corrupt the next view", () => {
    visibleAxes("3d").pop();
    expect(visibleAxes("3d")).toEqual(["x", "y", "z"]);
  });
});

describe("the graduation", () => {
  it("gives one grid square the side of one basis vector", () => {
    // The whole point of the reference grid: a square is the unit. Drawing
    // the arrows any longer than the step silently redefines the drawing's
    // unit, and the coordinates written beside the marked point stop
    // agreeing with what the reader counts off the grid.
    expect(GRID_STEP).toBe(AXIS_LENGTH);
  });

  it("keeps the arrows exactly one unit long", () => {
    expect(AXIS_LENGTH).toBe(1);
  });

  it("spans a whole number of squares each way", () => {
    expect(GRID_HALF % GRID_STEP).toBe(0);
    expect(GRID_SIZE).toBe(2 * GRID_HALF);
    // gridHelper draws `divisions` squares across `size`; a mismatch here
    // would put the origin inside a square instead of on a crossing.
    expect(GRID_DIVISIONS).toBe(GRID_SIZE / GRID_STEP);
    expect(GRID_DIVISIONS % 2).toBe(0);
  });
});

describe("rulerTicks", () => {
  it("graduates the 1D ruler at every unit, origin included", () => {
    expect(rulerTicks()).toEqual([-2, -1, 0, 1, 2]);
  });

  it("steps by exactly one basis vector between ticks", () => {
    const ticks = rulerTicks();
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(GRID_STEP);
    }
  });

  it("reaches the same distance as the plane does, both ways", () => {
    const ticks = rulerTicks();
    expect(ticks[0]).toBe(-GRID_HALF);
    expect(ticks[ticks.length - 1]).toBe(GRID_HALF);
  });

  it("lands the arrow tip on a graduation", () => {
    // The x arrow ends at AXIS_LENGTH; if that is not a tick, the drawing
    // shows a unit vector that reaches nowhere in particular.
    expect(rulerTicks()).toContain(AXIS_LENGTH);
  });
});

describe("rotationMode", () => {
  it("orbits only the triedro", () => {
    expect(rotationMode("3d")).toBe("orbit");
  });

  it("rolls the plane instead of orbiting it", () => {
    // A 2D frame has exactly one rotation available to it — about the ẑ it
    // would have in 3D. Orbiting would show the student a rotation the plane
    // cannot have, and would take a basis vector out of view edge-on.
    expect(rotationMode("2d")).toBe("roll");
  });

  it("gives the 1D line no rotation at all", () => {
    expect(rotationMode("1d")).toBe("none");
  });
});

describe("interactionHint", () => {
  it("names the plane's rotation as being about ẑ", () => {
    expect(interactionHint("2d")).toContain("ẑ");
  });

  it("does not claim the triedro turns about ẑ alone", () => {
    expect(interactionHint("3d")).toMatch(/Arraste/);
    expect(interactionHint("3d")).not.toContain("ẑ");
  });

  it("promises dragging only where dragging does something", () => {
    for (const dim of DIMENSIONS) {
      const draggable = rotationMode(dim) !== "none";
      // The hint and the control read the same predicate; a hint mentioning
      // rotation where there is none is a promise the scene breaks.
      expect(/Arraste/.test(interactionHint(dim))).toBe(draggable);
    }
  });

  it("offers zoom in every view", () => {
    for (const dim of DIMENSIONS) {
      expect(interactionHint(dim)).toMatch(/aproximar/);
    }
  });
});

describe("rollUp", () => {
  it("is the usual +y up when the frame is unrolled", () => {
    const [x, y, z] = rollUp(0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(z).toBe(0);
  });

  it("stays in the xy plane, so the camera never leaves the frontal view", () => {
    // A non-zero z here would tip the camera off the plane's normal — the one
    // thing this view must never do.
    for (const a of [0.3, 1, 2, -2.5, 7]) {
      expect(rollUp(a)[2]).toBe(0);
    }
  });

  it("stays a unit vector at every angle", () => {
    for (const a of [0, 0.7, 3, -1.2, 12]) {
      const [x, y] = rollUp(a);
      expect(Math.hypot(x, y)).toBeCloseTo(1);
    }
  });

  it("turns a quarter of a circle for a quarter turn", () => {
    const [x, y] = rollUp(Math.PI / 2);
    expect(x).toBeCloseTo(-1);
    expect(y).toBeCloseTo(0);
  });

  it("comes back to where it started after a full turn", () => {
    const [x, y] = rollUp(2 * Math.PI);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });
});

describe("shortestAngleDelta", () => {
  it("is a plain difference well inside the range", () => {
    expect(shortestAngleDelta(0.2, 0.5)).toBeCloseTo(0.3);
    expect(shortestAngleDelta(0.5, 0.2)).toBeCloseTo(-0.3);
  });

  it("takes the short way across the ±π seam", () => {
    // Without this the frame spins a full turn backwards the moment the
    // pointer crosses the left edge of the stage.
    expect(shortestAngleDelta(3.1, -3.1)).toBeCloseTo(0.0831853, 4);
    expect(shortestAngleDelta(-3.1, 3.1)).toBeCloseTo(-0.0831853, 4);
  });

  it("never returns more than half a turn", () => {
    for (const [a, b] of [
      [0, Math.PI],
      [-Math.PI, Math.PI],
      [2, -2],
      [-2, 2],
      [0.1, 6],
    ]) {
      expect(Math.abs(shortestAngleDelta(a, b))).toBeLessThanOrEqual(
        Math.PI + 1e-9,
      );
    }
  });

  it("is zero for no movement", () => {
    expect(shortestAngleDelta(1.234, 1.234)).toBe(0);
  });
});

describe("scene toggles", () => {
  it("gives the 1D view a ruler and the others a plane", () => {
    expect(referenceKind("1d")).toBe("ruler");
    expect(referenceKind("2d")).toBe("plane");
    expect(referenceKind("3d")).toBe("plane");
  });

  it("drops the dashed guides in 1D, where they have nowhere to run", () => {
    expect(showsProjections("1d")).toBe(false);
    expect(showsProjections("2d")).toBe(true);
    expect(showsProjections("3d")).toBe(true);
  });
});

describe("VIEW_CAMERA", () => {
  it("leaves the 3D view on the camera the print fallback was framed for", () => {
    expect(VIEW_CAMERA["3d"]).toBe(DEFAULT_CAMERA);
  });

  it("centres the 1D view on the origin, like the ruler it frames", () => {
    expect(VIEW_CAMERA["1d"].target).toEqual([0, 0, 0]);
  });

  it("frames the whole graduation in the flat views", () => {
    // Half-height visible at distance d is d·tan(fov/2); the grid needs
    // GRID_HALF of it, plus room for the axis labels just past the tips.
    for (const dim of ["1d", "2d"] as const) {
      const { position, target, fov } = VIEW_CAMERA[dim];
      const d = Math.hypot(
        position[0] - target[0],
        position[1] - target[1],
        position[2] - target[2],
      );
      const halfHeight = d * Math.tan((fov * Math.PI) / 360);
      // The stage is wider than it is tall, so the vertical extent is the
      // binding one for 2D; for 1D the ruler runs across the width.
      expect(halfHeight * (dim === "1d" ? 2 : 1)).toBeGreaterThan(GRID_HALF);
    }
  });

  it("looks straight down -y for the 1D line, so x runs across the page", () => {
    const { position, target } = VIEW_CAMERA["1d"];
    expect(position[0]).toBeCloseTo(target[0]);
    expect(position[2]).toBeCloseTo(target[2]);
    expect(position[1]).toBeLessThan(target[1]);
  });

  it("looks straight down +z for the 2D plane", () => {
    const { position, target } = VIEW_CAMERA["2d"];
    expect(position[0]).toBeCloseTo(target[0]);
    expect(position[1]).toBeCloseTo(target[1]);
    expect(position[2]).toBeGreaterThan(target[2]);
  });

  it("avoids the degenerate up vector in the 2D view", () => {
    // Looking along -z with the scene's usual +z up has no defined right
    // vector: the projection would come out NaN and print nothing at all.
    expect(VIEW_CAMERA["2d"].up).toEqual([0, 1, 0]);
    expect(VIEW_CAMERA["1d"].up).toEqual([0, 0, 1]);
  });

  it("frames the 3D triedro large enough to read as the subject", () => {
    // The unit frame is what the figure is about, so it has to own the stage:
    // measured on the widget's own aspect, the drop from the ẑ label to the
    // origin covers most of the height. It stood at barely a quarter of it
    // when the camera was 5.7 units out.
    const viewport = { width: 780, height: 250 };
    const origin = project([0, 0, 0], viewport, VIEW_CAMERA["3d"])!;
    const zLabel = project(
      axisLabelAnchor("z", "3d"),
      viewport,
      VIEW_CAMERA["3d"],
    )!;
    const span = (origin[1] - zLabel[1]) / viewport.height;
    expect(span).toBeGreaterThan(0.4);
    // …without pushing the label off the top of the stage.
    expect(zLabel[1]).toBeGreaterThan(0);
  });

  it("stands the camera clear of the origin in every view", () => {
    for (const dim of DIMENSIONS) {
      const { position, target } = VIEW_CAMERA[dim];
      const d = Math.hypot(
        position[0] - target[0],
        position[1] - target[1],
        position[2] - target[2],
      );
      expect(d).toBeGreaterThan(2.5);
    }
  });
});

describe("clampPoint", () => {
  const p = [1.5, 1, 0.8] as [number, number, number];

  it("keeps every coordinate in 3D", () => {
    expect(clampPoint(p, "3d")).toEqual([1.5, 1, 0.8]);
  });

  it("drops the point onto the xy plane in 2D", () => {
    expect(clampPoint(p, "2d")).toEqual([1.5, 1, 0]);
  });

  it("drops the point onto the x axis in 1D", () => {
    expect(clampPoint(p, "1d")).toEqual([1.5, 0, 0]);
  });

  it("leaves the authored tuple untouched", () => {
    // The widget re-clamps the same authored prop on every switch, so a
    // mutating implementation would degrade the point to (1.5, 0, 0) forever.
    clampPoint(p, "1d");
    expect(p).toEqual([1.5, 1, 0.8]);
  });

  it("preserves negatives and zeros rather than treating them as absent", () => {
    expect(clampPoint([-2, 0, -0.5], "2d")).toEqual([-2, 0, 0]);
  });
});

describe("axisLabelAnchor", () => {
  it("sets each label just past its own arrow tip", () => {
    expect(axisLabelAnchor("x", "3d")).toEqual([1.2, 0, 0]);
    expect(axisLabelAnchor("y", "3d")).toEqual([0, 1.2, 0]);
    expect(axisLabelAnchor("z", "3d")).toEqual([0, 0, 1.2]);
  });

  it("honours a caller-chosen offset, so paper can sit wider than screen", () => {
    expect(axisLabelAnchor("z", "3d", 0.28)).toEqual([0, 0, 1.28]);
  });

  it("hangs the 1D label below the ruler instead of past the tip", () => {
    // Past the tip is where the graduation and any marked point already are.
    const [x, y, z] = axisLabelAnchor("x", "1d");
    expect(x).toBe(1);
    expect(y).toBe(0);
    expect(z).toBeLessThan(0);
  });

  it("keeps the 1D label clear of a point label lifted the other way", () => {
    const label = axisLabelAnchor("x", "1d")[2];
    const point = labelAnchor([1, 0, 0], "1d")[2];
    expect(point - label).toBeGreaterThan(0.35);
  });
});

describe("labelAnchor", () => {
  const p = [1.5, 1, 0.8] as [number, number, number];

  it("lifts the label along +z in the 3D and 1D views", () => {
    expect(labelAnchor(p, "3d")).toEqual([1.5, 1, 1.02]);
    expect(labelAnchor(p, "1d")).toEqual([1.5, 1, 1.02]);
  });

  it("lifts it along +y in the 2D view, where +z points at the camera", () => {
    // Offsetting along +z here would leave the label on top of the sphere.
    expect(labelAnchor(p, "2d")).toEqual([1.5, 1.22, 0.8]);
  });

  it("always moves the label somewhere, in every view", () => {
    for (const dim of DIMENSIONS) {
      const moved = labelAnchor(p, dim);
      const d = Math.hypot(moved[0] - p[0], moved[1] - p[1], moved[2] - p[2]);
      expect(d).toBeCloseTo(0.22);
    }
  });

  it("honours a caller-chosen distance", () => {
    expect(labelAnchor(p, "2d", 0.26)).toEqual([1.5, 1.26, 0.8]);
  });

  it("leaves the point it was handed untouched", () => {
    labelAnchor(p, "2d");
    expect(p).toEqual([1.5, 1, 0.8]);
  });
});

describe("formatCoords", () => {
  it("writes only the coordinates the view actually has", () => {
    const p = [1.5, 1, 0.8] as [number, number, number];
    expect(formatCoords(p, "3d")).toBe("(1.5, 1, 0.8)");
    expect(formatCoords(p, "2d")).toBe("(1.5, 1)");
    expect(formatCoords(p, "1d")).toBe("(1.5)");
  });

  it("writes the clamped zeros, matching what is drawn", () => {
    expect(formatCoords(clampPoint([1, 2, 3], "2d"), "2d")).toBe("(1, 2)");
  });
});
