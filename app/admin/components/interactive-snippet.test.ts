/**
 * interactive-snippet.test.ts — the template the MDX toolbar inserts.
 *
 * The editor's contract with `insertSnippet` is what matters here: the caption
 * must be a `${1:…}` slot, or selecting a paragraph and picking a widget
 * silently discards the selection instead of captioning the block with it.
 */
import { describe, it, expect } from "vitest";
import {
  CAPTION_PLACEHOLDER,
  interactiveTemplate,
} from "./interactive-snippet";
import { catalog, widgetIds } from "@/components/interactive/catalog";

const meta = catalog[widgetIds()[0]];

describe("interactiveTemplate", () => {
  it("emits an Interactive block naming the widget", () => {
    const out = interactiveTemplate(meta);
    expect(out).toContain(`<Interactive widget="${meta.id}"`);
    expect(out).toContain("</Interactive>");
  });

  it("puts the caption in slot 1 so a selection can fill it", () => {
    expect(interactiveTemplate(meta)).toContain(CAPTION_PLACEHOLDER);
    expect(CAPTION_PLACEHOLDER).toMatch(/^\$\{1:[^}]*\}$/);
  });

  it("leaves a blank line after the block, like every other snippet", () => {
    expect(interactiveTemplate(meta)).toMatch(/<\/Interactive>\n\n$/);
  });

  it("survives the placeholder stripping the toolbar does with no selection", () => {
    // Mirrors insertSnippet's fallback path.
    const stripped = interactiveTemplate(meta).replace(
      /\$\{(\d+):([^}]*)\}/g,
      "$2",
    );
    expect(stripped).not.toContain("${");
    expect(stripped).toContain("Legenda do bloco interativo");
  });

  it("builds a template for every catalogued widget", () => {
    for (const id of widgetIds()) {
      expect(interactiveTemplate(catalog[id])).toContain(`widget="${id}"`);
    }
  });
});
