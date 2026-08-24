/**
 * mdx-pipeline.test.ts — extractHeadings, which builds the table of contents.
 *
 * Heading ids must match the anchors rehype generates in the rendered page,
 * so slug collisions and depth limits are the behaviour worth pinning down.
 */
import { describe, it, expect } from "vitest";
import { extractHeadings } from "./mdx-pipeline";

describe("extractHeadings", () => {
  it("returns nothing for prose without headings", () => {
    expect(extractHeadings("Apenas um parágrafo.")).toEqual([]);
  });

  it("captures text, level and slugified id", () => {
    expect(extractHeadings("## Cinemática Direta")).toEqual([
      { id: "cinemática-direta", text: "Cinemática Direta", level: 2 },
    ]);
  });

  it("keeps levels 1 through 4 in document order", () => {
    const md = "# Um\n\n## Dois\n\n### Três\n\n#### Quatro";
    expect(extractHeadings(md).map((h) => h.level)).toEqual([1, 2, 3, 4]);
  });

  it("ignores levels deeper than 4", () => {
    const md = "## Mantido\n\n##### Ignorado\n\n###### Ignorado também";
    expect(extractHeadings(md).map((h) => h.text)).toEqual(["Mantido"]);
  });

  it("disambiguates repeated headings with a numeric suffix", () => {
    // GithubSlugger is stateful per call; two identical headings must not
    // collapse onto the same anchor.
    const md = "## Exemplo\n\n## Exemplo";
    expect(extractHeadings(md).map((h) => h.id)).toEqual([
      "exemplo",
      "exemplo-1",
    ]);
  });

  it("starts slug numbering fresh on each call", () => {
    // A leaked slugger would make the second render of the same document
    // produce exemplo-1 instead of exemplo.
    const md = "## Exemplo";
    expect(extractHeadings(md)[0].id).toBe("exemplo");
    expect(extractHeadings(md)[0].id).toBe("exemplo");
  });

  it("flattens inline markup into plain heading text", () => {
    const [h] = extractHeadings("## Texto com **negrito** e `código`");
    expect(h.text).toBe("Texto com negrito e código");
  });

  it("skips a heading with no text content", () => {
    expect(extractHeadings("##\n\n## Real")).toEqual([
      { id: "real", text: "Real", level: 2 },
    ]);
  });

  it("does not treat a # inside a fenced code block as a heading", () => {
    const md = "```bash\n# não é título\n```\n\n## É título";
    expect(extractHeadings(md).map((h) => h.text)).toEqual(["É título"]);
  });
});
