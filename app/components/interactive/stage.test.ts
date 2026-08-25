import { describe, it, expect } from "vitest";
import { PRESENTATION_MAX_VH, stageHeight } from "./stage";

describe("stageHeight", () => {
  it("uses the authored height verbatim while reading", () => {
    expect(stageHeight("texto", 420)).toBe("420px");
  });

  it("caps against the viewport on a slide", () => {
    expect(stageHeight("apresentacao", 420)).toBe(
      `min(420px, ${PRESENTATION_MAX_VH}vh)`,
    );
  });

  it("keeps the authored height as the upper bound, never raising it", () => {
    // A short block must not be inflated to 48vh just because it is on a slide.
    expect(stageHeight("apresentacao", 180)).toContain("180px");
    expect(stageHeight("apresentacao", 180).startsWith("min(")).toBe(true);
  });

  it("leaves the presentation ceiling below full viewport height", () => {
    expect(PRESENTATION_MAX_VH).toBeGreaterThan(0);
    expect(PRESENTATION_MAX_VH).toBeLessThan(100);
  });
});
