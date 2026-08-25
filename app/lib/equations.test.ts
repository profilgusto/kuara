import { describe, it, expect } from "vitest";
import { eqElementId, equationNumber, normalizeEqLabel } from "./equations";

describe("normalizeEqLabel", () => {
  it("adds the eq: namespace when the author omitted it", () => {
    expect(normalizeEqLabel("massa")).toBe("eq:massa");
  });

  it("keeps an already-namespaced label untouched", () => {
    expect(normalizeEqLabel("eq:massa")).toBe("eq:massa");
  });

  it("trims surrounding whitespace before deciding", () => {
    expect(normalizeEqLabel("  eq:massa  ")).toBe("eq:massa");
    expect(normalizeEqLabel("  massa  ")).toBe("eq:massa");
  });

  it("does not treat 'eq' inside the name as the namespace", () => {
    expect(normalizeEqLabel("equilibrio")).toBe("eq:equilibrio");
  });

  it("survives an empty label without crashing", () => {
    expect(normalizeEqLabel("")).toBe("eq:");
  });
});

describe("eqElementId", () => {
  it("builds the MathJax element id", () => {
    expect(eqElementId("massa")).toBe("mjx-eqn:eq:massa");
    expect(eqElementId("eq:massa")).toBe("mjx-eqn:eq:massa");
  });
});

describe("equationNumber", () => {
  // MathJax ids in document order: labelled and auto-numbered ones interleave.
  const ids = [
    "mjx-eqn:eq:um",
    "mjx-eqn:2",
    "mjx-eqn:eq:tres",
    "mjx-eqn:eq:quatro",
  ];

  it("returns the 1-based position of a labelled equation", () => {
    expect(equationNumber(ids, "mjx-eqn:eq:um")).toBe(1);
    expect(equationNumber(ids, "mjx-eqn:eq:tres")).toBe(3);
    expect(equationNumber(ids, "mjx-eqn:eq:quatro")).toBe(4);
  });

  it("counts unlabelled equations towards the numbering", () => {
    // "eq:tres" is the third *numbered* equation even though only two of the
    // preceding ones carry an author label.
    expect(equationNumber(ids, "mjx-eqn:2")).toBe(2);
  });

  it("returns -1 for an unknown label", () => {
    expect(equationNumber(ids, "mjx-eqn:eq:inexistente")).toBe(-1);
  });

  it("returns -1 when nothing has been rendered yet", () => {
    expect(equationNumber([], "mjx-eqn:eq:um")).toBe(-1);
  });
});
