/**
 * RefEq.test.tsx — inline "Eq. N" cross-reference.
 *
 * The number is NOT seeded from the MDX source (as figures are): MathJax
 * assigns it at render time and stamps each numbered row with an `mjx-eqn:*`
 * id. RefEq reads the number back from the DOM, so these tests stand in a
 * MathJax-shaped document and assert what the link says.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import RefEq from "./RefEq";

/**
 * Mimics rehype-mathjax output: one `mjx-container` per numbered equation,
 * each holding the id MathJax derives from the author's `\label{...}` — or a
 * bare running number when the equation carries no label.
 */
function renderDocument(ids: string[]) {
  const doc = document.createElement("div");
  for (const id of ids) {
    const container = document.createElement("mjx-container");
    const row = document.createElement("span");
    row.id = `mjx-eqn:${id}`;
    container.appendChild(row);
    doc.appendChild(container);
  }
  document.body.appendChild(doc);
  return doc;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("RefEq", () => {
  it('renders "Eq. N" for a labelled equation', () => {
    renderDocument(["eq:massa"]);
    const { container } = render(<RefEq label="eq:massa" />);
    expect(container.textContent).toBe("Eq. 1");
  });

  it("accepts a label written without the eq: prefix", () => {
    renderDocument(["eq:massa"]);
    const { container } = render(<RefEq label="massa" />);
    expect(container.textContent).toBe("Eq. 1");
  });

  it("counts unlabelled equations towards the number", () => {
    // MathJax numbers every equation, labelled or not — the second container
    // here is an unlabelled `\begin{equation}`, so the target is Eq. 3.
    renderDocument(["eq:um", "2", "eq:tres"]);
    const { container } = render(<RefEq label="eq:tres" />);
    expect(container.textContent).toBe("Eq. 3");
  });

  it("degrades to a muted marker when the label does not exist", () => {
    renderDocument(["eq:massa"]);
    const { container } = render(<RefEq label="eq:fantasma" />);
    expect(container.textContent).toBe("[Eq.eq:fantasma?]");
    expect(container.querySelector("button")).toBeNull();
  });

  it("degrades when no equation has been rendered at all", () => {
    const { container } = render(<RefEq label="eq:massa" />);
    expect(container.textContent).toBe("[Eq.eq:massa?]");
  });

  it("uses the same muted-to-foreground colouring as RefFig", () => {
    renderDocument(["eq:massa"]);
    const { container } = render(<RefEq label="eq:massa" />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("text-muted-foreground");
    expect(button?.className).toContain("hover:text-foreground");
  });
});
