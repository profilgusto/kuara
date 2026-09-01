/**
 * rotation.test.ts — what this widget adds to the shared orientation algebra:
 * the hint under its stage and how its formula copes with a long session.
 *
 * The mathematics itself is covered in `components/interactive/rotations.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  DIMENSIONS,
  MAX_SHOWN_FACTORS,
  VIEW_CAMERA,
  anglesFor,
  dimensionNote,
  dragMode,
  elementary,
  formatMatrix,
  interactionHint,
  matrixOrder,
  rotationMatrix,
  showsModeSwitch,
  shownFactors,
  submatrix,
  turnAxes,
  visibleAxes,
  wrapText,
  type Dimension,
  type IntrinsicStep,
} from "./rotation";

describe("interactionHint", () => {
  it("names the camera drag in both modes of the 3D view", () => {
    // The orbit is the one gesture that means the same thing either way, and
    // it is the one a student is most likely not to discover on their own.
    for (const mode of ["inercial", "proprio"] as const) {
      expect(interactionHint("3d", mode)).toContain(
        "Arraste para girar a câmera",
      );
    }
  });

  it("warns that an own-axis slider springs back", () => {
    // A slider that returns to zero on release looks broken unless the widget
    // has said, in advance, that this is what it does.
    const hint = interactionHint("3d", "proprio");
    expect(hint).toContain("volta a zero");
    expect(hint).toContain("próprio eixo");
  });

  it("keeps the inertial hint free of session vocabulary", () => {
    expect(interactionHint("3d", "inercial")).not.toContain("volta a zero");
  });

  it("promises no rotation on a line, whatever the switch last said", () => {
    for (const mode of ["inercial", "proprio"] as const) {
      const hint = interactionHint("1d", mode);
      expect(hint).toContain("Sem rotação");
      expect(hint).not.toContain("slider");
    }
  });

  it("names ẑ as the plane's one axis", () => {
    for (const mode of ["inercial", "proprio"] as const) {
      expect(interactionHint("2d", mode)).toContain("ẑ");
    }
  });
});

describe("what each dimension can turn about", () => {
  it("gives a line no rotation at all", () => {
    // SO(1) is trivial: the only length- and orientation-preserving 1×1
    // matrix is [1].
    expect(turnAxes("1d")).toEqual([]);
    expect(matrixOrder("1d")).toBe(1);
  });

  it("gives a plane exactly one axis, and it is not one it draws", () => {
    // The plane turns about the ẑ it would have in 3D — turning about x̂ or ŷ
    // would lift the frame off the page.
    expect(turnAxes("2d")).toEqual(["z"]);
    expect(visibleAxes("2d")).toEqual(["x", "y"]);
    expect(turnAxes("2d").every((a) => !visibleAxes("2d").includes(a))).toBe(
      true,
    );
  });

  it("gives space all three", () => {
    expect(turnAxes("3d")).toEqual(["x", "y", "z"]);
    expect(matrixOrder("3d")).toBe(3);
  });

  it("offers the mode switch only where an order can differ", () => {
    // One rotation composes with nothing, so there is no order to reverse.
    expect(showsModeSwitch("1d")).toBe(false);
    expect(showsModeSwitch("2d")).toBe(false);
    expect(showsModeSwitch("3d")).toBe(true);
  });

  it("agrees with itself about how many axes each view has", () => {
    for (const dim of DIMENSIONS) {
      expect(turnAxes(dim).length).toBeLessThanOrEqual(matrixOrder(dim));
      expect(visibleAxes(dim)).toHaveLength(matrixOrder(dim));
    }
  });

  it("explains the flat views, and lets the 3D one speak for itself", () => {
    expect(dimensionNote("1d")).toContain("[1]");
    expect(dimensionNote("2d")).toContain("ẑ");
    expect(dimensionNote("3d")).toBe("");
  });

  it("heads off the question [−1] raises, and answers it correctly", () => {
    // [−1] preserves lengths, so a reader is right to wonder. It is a
    // reflection: det = −1 puts it outside SO(1), and no continuous turn
    // reaches it. Getting this sentence wrong would teach a wrong definition
    // of what a rotation matrix is.
    const note = dimensionNote("1d");
    expect(note).toContain("−1");
    expect(note).toContain("det = −1");
    expect(note).toContain("reflexão");
    expect(note).toMatch(/não é uma rotação|reflexão, não uma rotação/);
    expect(note).toContain("contínuo");
    // …and it must not call it a rotation of any kind.
    expect(note).not.toMatch(/rotação de 180|meia volta/);
  });
});

describe("anglesFor", () => {
  it("drops the turns a view has no axis for", () => {
    expect(anglesFor("1d", [30, 40, 50])).toEqual([0, 0, 0]);
    expect(anglesFor("2d", [30, 40, 50])).toEqual([0, 0, 50]);
    expect(anglesFor("3d", [30, 40, 50])).toEqual([30, 40, 50]);
  });

  it("keeps a flat view flat, whatever the author wrote", () => {
    // A 2D block authored with an x turn must not print a frame tipped out of
    // the page — the axis of that turn is not on the drawing.
    const m = rotationMatrix(anglesFor("2d", [90, 0, 0]), "inercial");
    expect(submatrix(m, "2d")).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe("submatrix", () => {
  it("prints the plane's rotation as the 2×2 of the section", () => {
    const m = rotationMatrix(anglesFor("2d", [0, 0, 30]), "inercial");
    const [[a, b], [c, d]] = submatrix(m, "2d");
    const rad = (30 * Math.PI) / 180;
    expect(a).toBeCloseTo(Math.cos(rad), 12);
    expect(b).toBeCloseTo(-Math.sin(rad), 12);
    expect(c).toBeCloseTo(Math.sin(rad), 12);
    expect(d).toBeCloseTo(Math.cos(rad), 12);
  });

  it("prints the line's rotation as [1], the only one there is", () => {
    for (const angles of [
      [0, 0, 0],
      [90, 45, 30],
    ] as const) {
      const m = rotationMatrix(anglesFor("1d", [...angles]), "inercial");
      expect(submatrix(m, "1d")).toEqual([[1]]);
    }
  });

  it("leaves the 3D matrix whole", () => {
    const m = elementary("y", 25);
    expect(submatrix(m, "3d")).toEqual(m);
  });

  it("hands the panel one row per column, whatever the view", () => {
    for (const dim of DIMENSIONS) {
      const rows = formatMatrix(
        rotationMatrix(anglesFor(dim, [10, 20, 30]), "inercial"),
        2,
      ).slice(0, matrixOrder(dim));
      expect(submatrix(elementary("z", 10), dim)).toHaveLength(rows.length);
    }
  });
});

describe("the cameras", () => {
  it("looks straight down an axis in the flat views", () => {
    // Anything else draws a foreshortened 3D scene and calls it a plane.
    expect(VIEW_CAMERA["1d"].position[0]).toBe(0);
    expect(VIEW_CAMERA["1d"].position[2]).toBe(0);
    expect(VIEW_CAMERA["2d"].position[0]).toBe(0);
    expect(VIEW_CAMERA["2d"].position[1]).toBe(0);
  });

  it("avoids the degenerate up vector in the 2D view", () => {
    // Looking along -z with +z up has no defined right vector: the projection
    // would come out NaN and print nothing at all.
    expect(VIEW_CAMERA["2d"].up).toEqual([0, 1, 0]);
    expect(VIEW_CAMERA["1d"].up).toEqual([0, 0, 1]);
  });

  it("keeps the 3D view on the camera the print fallback was framed for", () => {
    expect(VIEW_CAMERA["3d"].position).toEqual([2.7, -3.0, 2.2]);
  });

  it("stands clear of the origin in every view", () => {
    for (const dim of DIMENSIONS) {
      const { position, target } = VIEW_CAMERA[dim];
      expect(
        Math.hypot(
          position[0] - target[0],
          position[1] - target[1],
          position[2] - target[2],
        ),
      ).toBeGreaterThan(2);
    }
  });

  it("answers a drag with what each view can actually do", () => {
    // A line cannot turn, a plane rolls in place, and only space orbits.
    const modes: Record<Dimension, string> = {
      "1d": "none",
      "2d": "roll",
      "3d": "orbit",
    };
    for (const dim of DIMENSIONS) expect(dragMode(dim)).toBe(modes[dim]);
  });
});

describe("wrapText", () => {
  it("breaks a note into lines the page can hold", () => {
    const lines = wrapText(dimensionNote("1d"), 64);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(64);
  });

  it("moves whole words and loses none of them", () => {
    const note = dimensionNote("2d");
    expect(wrapText(note, 40).join(" ")).toBe(note.replace(/\s+/g, " "));
  });

  it("gives a word longer than the budget a line of its own", () => {
    // Never an empty line before it, which is what a naive break produces —
    // and a leading over-long word is where that shows.
    expect(wrapText("supercalifragilistic ab cd", 8)).toEqual([
      "supercalifragilistic",
      "ab cd",
    ]);
    expect(wrapText("ab supercalifragilistic cd", 8)).toEqual([
      "ab",
      "supercalifragilistic",
      "cd",
    ]);
  });

  it("has nothing to say about nothing", () => {
    expect(wrapText("", 40)).toEqual([]);
    expect(wrapText(dimensionNote("3d"), 40)).toEqual([]);
  });
});

describe("shownFactors", () => {
  const steps = (n: number): IntrinsicStep[] =>
    Array.from({ length: n }, (_, i) => ({ axis: "x", deg: i + 1 }) as const);

  it("shows every factor of a session that fits", () => {
    const { shown, elided } = shownFactors(steps(MAX_SHOWN_FACTORS));
    expect(shown).toHaveLength(MAX_SHOWN_FACTORS);
    expect(elided).toBe(false);
  });

  it("keeps the newest factors and elides the rest", () => {
    // The right-hand end is where the student's last turn joined the product.
    const { shown, elided } = shownFactors(steps(MAX_SHOWN_FACTORS + 3));
    expect(elided).toBe(true);
    expect(shown).toHaveLength(MAX_SHOWN_FACTORS);
    expect(shown[shown.length - 1].deg).toBe(MAX_SHOWN_FACTORS + 3);
  });

  it("shows nothing, and elides nothing, before the first step", () => {
    expect(shownFactors([])).toEqual({ shown: [], elided: false });
  });

  it("honours a caller's own limit", () => {
    const { shown, elided } = shownFactors(steps(3), 2);
    expect(shown.map((s) => s.deg)).toEqual([2, 3]);
    expect(elided).toBe(true);
  });
});
