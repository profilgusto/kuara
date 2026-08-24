/**
 * cross-references.test.ts — the three sibling extractors that scan raw MDX
 * for cross-reference components: <CiteModule>, <CiteTessela> and <KImage>.
 *
 * They share an identical shape (unique slugs/labels in document order), so
 * they share a table-driven contract here. Anything specific to one extractor
 * gets its own case below.
 */
import { describe, it, expect } from "vitest";
import { extractCiteModuleSlugs } from "./module-links";
import { extractCiteTesselaSlugs } from "./tessela-links";
import { extractFigureLabels } from "./figures";

const extractors = [
  {
    nome: "extractCiteModuleSlugs",
    fn: extractCiteModuleSlugs,
    tag: "CiteModule",
    attr: "slug",
  },
  {
    nome: "extractCiteTesselaSlugs",
    fn: extractCiteTesselaSlugs,
    tag: "CiteTessela",
    attr: "slug",
  },
  {
    nome: "extractFigureLabels",
    fn: extractFigureLabels,
    tag: "KImage",
    attr: "label",
  },
] as const;

describe.each(extractors)("$nome", ({ fn, tag, attr }) => {
  it("returns an empty list when the component is absent", () => {
    expect(fn("Um parágrafo qualquer.")).toEqual([]);
  });

  it("extracts a single value", () => {
    expect(fn(`<${tag} ${attr}="cinematica" />`)).toEqual(["cinematica"]);
  });

  it("preserves first-appearance order and drops duplicates", () => {
    const mdx = `
      <${tag} ${attr}="cinematica" />
      <${tag} ${attr}="dinamica" />
      <${tag} ${attr}="cinematica" />
    `;
    expect(fn(mdx)).toEqual(["cinematica", "dinamica"]);
  });

  it("reads the attribute even when others precede it", () => {
    expect(fn(`<${tag} class="destaque" ${attr}="cinematica" />`)).toEqual([
      "cinematica",
    ]);
  });

  it("ignores a component whose name merely shares the prefix", () => {
    expect(fn(`<${tag}Outro ${attr}="cinematica" />`)).toEqual([]);
  });

  it("handles several occurrences spread across a long document", () => {
    const mdx = [
      "# Título",
      `<${tag} ${attr}="a" />`,
      "texto ".repeat(200),
      `<${tag} ${attr}="b" />`,
    ].join("\n");
    expect(fn(mdx)).toEqual(["a", "b"]);
  });
});

describe("extractor isolation", () => {
  it("each extractor ignores the other components' tags", () => {
    // All three run over the same document during a render; a regex that
    // leaked across tags would seed the wrong provider.
    const mdx = `
      <CiteModule slug="modulo" />
      <CiteTessela slug="tessela" />
      <KImage label="figura" url="/media/f.png" />
    `;
    expect(extractCiteModuleSlugs(mdx)).toEqual(["modulo"]);
    expect(extractCiteTesselaSlugs(mdx)).toEqual(["tessela"]);
    expect(extractFigureLabels(mdx)).toEqual(["figura"]);
  });
});
