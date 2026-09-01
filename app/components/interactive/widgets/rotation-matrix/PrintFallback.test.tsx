/**
 * PrintFallback.test.tsx — what each view actually prints.
 *
 * The fallback is the only part of this widget a unit test can render: it
 * imports the maths module and React, and takes `RotationMatrixProps` as a
 * type alone, so none of three.js comes with it. What it draws is therefore
 * checkable here — and it is worth checking, because paper is where nobody
 * notices a 2D block that printed a 3D scene until the handout is on a desk.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RotationMatrixPrint from "./PrintFallback";
import { DIMENSIONS, dimensionNote, matrixOrder } from "./rotation";

const draw = (props: Partial<Parameters<typeof RotationMatrixPrint>[0]> = {}) =>
  render(
    <RotationMatrixPrint
      angles={[0, 0, 30]}
      mode="inercial"
      step={5}
      decimals={2}
      inertialName="I"
      rotatedName="R"
      labels
      grid
      {...props}
    />,
  ).container;

/** One arrowhead per axis drawn, and the drawing has two frames in it. */
const arrowheads = (c: HTMLElement) => c.querySelectorAll("polygon").length;

describe("what each view prints", () => {
  it("draws one axis per frame on the line, two on the plane, three in space", () => {
    expect(arrowheads(draw({ variant: "1d" }))).toBe(2);
    expect(arrowheads(draw({ variant: "2d" }))).toBe(4);
    expect(arrowheads(draw({ variant: "3d" }))).toBe(6);
  });

  it("prints the matrix of the view's own order", () => {
    // The entries carry the axis tint, so counting the tinted cells counts the
    // matrix: 1, then 4, then 9.
    for (const dim of DIMENSIONS) {
      const c = draw({ variant: dim });
      const entries = [...c.querySelectorAll("text")].filter((t) =>
        /^-?\d+\.\d\d$/.test(t.textContent ?? ""),
      );
      expect(entries).toHaveLength(matrixOrder(dim) ** 2);
    }
  });

  it("prints [1] for the line, whatever angles were authored", () => {
    const c = draw({ variant: "1d", angles: [90, 45, 30] });
    const entries = [...c.querySelectorAll("text")]
      .map((t) => t.textContent)
      .filter((t) => /^-?\d+\.\d\d$/.test(t ?? ""));
    expect(entries).toEqual(["1.00"]);
  });

  it("prints the plane's rotation as a 2×2 that is not the identity", () => {
    const c = draw({ variant: "2d", angles: [0, 0, 30] });
    const entries = [...c.querySelectorAll("text")]
      .map((t) => t.textContent)
      .filter((t) => /^-?\d+\.\d\d$/.test(t ?? ""));
    expect(entries).toEqual(["0.87", "-0.50", "0.50", "0.87"]);
  });

  it("says on paper why a flat view has no sliders", () => {
    // The controls explain themselves on screen; on paper they are absent.
    for (const dim of ["1d", "2d"] as const) {
      expect(draw({ variant: dim }).textContent).toContain(
        dimensionNote(dim).slice(0, 24),
      );
    }
  });

  it("wraps the note instead of running it off the page", () => {
    // One <text> would overflow the 800-unit viewBox silently.
    const c = draw({ variant: "1d" });
    const lines = [...c.querySelectorAll("text")]
      .filter((t) => (t.textContent ?? "").includes("reflexão"))
      .flatMap((t) => [...t.querySelectorAll("tspan")]);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect((line.textContent ?? "").length).toBeLessThanOrEqual(64);
      // Re-anchored per line: `dy` alone would left-creep the block.
      expect(line.getAttribute("x")).toBe("778");
    }
  });

  it("spells the product out only where its order can differ", () => {
    expect(draw({ variant: "3d" }).textContent).toContain("Rz · Ry · Rx");
    expect(draw({ variant: "2d" }).textContent).not.toContain("Rz ·");
    expect(draw({ variant: "1d" }).textContent).not.toContain("Rz");
  });

  it("falls back to the full triedro when no variant is set", () => {
    // Rendered outside the box — the admin thumbnail, a direct import — the
    // prop is absent and the widget must still draw itself.
    expect(arrowheads(draw())).toBe(6);
  });
});
