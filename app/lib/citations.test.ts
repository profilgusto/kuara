/**
 * citations.test.ts — extractCiteLabels, which pre-seeds the citation provider.
 *
 * A missed label renders as an unresolved citation in published content, so
 * the parsing edge cases below are the ones that matter in authored MDX.
 */
import { describe, it, expect } from "vitest";
import { extractCiteLabels } from "./citations";

describe("extractCiteLabels", () => {
  it("returns an empty list for content with no citations", () => {
    expect(extractCiteLabels("Texto sem citações.")).toEqual([]);
  });

  it("extracts a single label", () => {
    expect(extractCiteLabels('<Cite label="corke2011" />')).toEqual([
      "corke2011",
    ]);
  });

  it("preserves document order and drops duplicates", () => {
    const mdx = `
      <Cite label="corke2011" /> texto
      <Cite label="siciliano2009" /> mais texto
      <Cite label="corke2011" /> repetida
    `;
    expect(extractCiteLabels(mdx)).toEqual(["corke2011", "siciliano2009"]);
  });

  it("extracts every key from a labels={[...]} array", () => {
    const mdx = '<Cite labels={["corke2011","siciliano2009"]} />';
    expect(extractCiteLabels(mdx)).toEqual(["corke2011", "siciliano2009"]);
  });

  it("accepts single-quoted arrays, which MDX authors write freely", () => {
    const mdx = "<Cite labels={['corke2011','siciliano2009']} />";
    expect(extractCiteLabels(mdx)).toEqual(["corke2011", "siciliano2009"]);
  });

  it("skips a malformed array instead of throwing", () => {
    // JSON.parse fails here; the extractor must degrade, not crash the render.
    const mdx = '<Cite label="valida" /><Cite labels={[quebrada,,]} />';
    expect(extractCiteLabels(mdx)).toEqual(["valida"]);
  });

  it("deduplicates across single and array forms", () => {
    const mdx = `
      <Cite label="corke2011" />
      <Cite labels={["corke2011","novo"]} />
    `;
    expect(extractCiteLabels(mdx)).toEqual(["corke2011", "novo"]);
  });

  it("reads label= regardless of other attributes preceding it", () => {
    expect(extractCiteLabels('<Cite style="apa" label="corke2011" />')).toEqual(
      ["corke2011"],
    );
  });

  it("does not match a component whose name merely starts with Cite", () => {
    // <CiteModule>/<CiteTessela> have their own extractors; the \b guard in
    // the regex is what keeps them out of the bibliography.
    const mdx = '<CiteModule slug="cinematica" />';
    expect(extractCiteLabels(mdx)).toEqual([]);
  });
});
