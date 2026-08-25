/**
 * previews.test.ts — every catalogued widget must be drawable on paper.
 *
 * The preview doubles as the print fallback and as the Payload library's
 * thumbnail; a widget missing one prints as bare text and shows up in the
 * admin as "sem pré-visualização".
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { catalog, widgetIds } from "./catalog";
import { getPreview, previews } from "./previews";

describe("widget previews", () => {
  it.each(widgetIds())("%s has a preview registered", (id) => {
    expect(getPreview(id)).toBeDefined();
  });

  it("registers no preview for a widget that does not exist", () => {
    expect(getPreview("nao-existe")).toBeUndefined();
    expect(Object.keys(previews).every((id) => id in catalog)).toBe(true);
  });

  it.each(widgetIds())("%s renders an svg from its declared defaults", (id) => {
    const Preview = getPreview(id)!;
    const props: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(catalog[id].props)) {
      props[name] = spec.default;
    }

    const html = renderToStaticMarkup(createElement(Preview, props));
    expect(html.startsWith("<svg")).toBe(true);
    // A drawing with no strokes would be a blank box on the printed page.
    expect(html).toMatch(/<(line|polygon|circle|path)/);
    expect(html).not.toContain("NaN");
  });
});
