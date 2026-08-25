/**
 * snippet.test.ts — the copy-paste example and the parameter formatting.
 *
 * Two very different surfaces render from these helpers (the authoring guide
 * and the Payload library view), so a change here shows up in both. That is
 * the point, and the reason they are pinned.
 */
import { describe, it, expect } from "vitest";
import { bool, enumOf, num, str, vec3 } from "./props";
import { defaultToken, mdxSnippet, typeTokens } from "./snippet";
import type { WidgetMeta } from "./catalog";
import { catalog, widgetIds } from "./catalog";

const meta: WidgetMeta = {
  id: "demo-widget",
  title: "Demo",
  description: "Para os testes.",
  defaultHeight: 320,
  props: {
    labels: bool(true, "d"),
    name: str("A", "d"),
    point: vec3(null, "d"),
    size: num(2, "d"),
  },
};

describe("mdxSnippet", () => {
  it("produces the shortest correct example", () => {
    expect(mdxSnippet(meta)).toBe(
      '<Interactive widget="demo-widget" height="320">\n' +
        "Caption shown below the block, and in place of it when printing.\n" +
        "</Interactive>",
    );
  });

  it("omits height when the widget declares none", () => {
    const withoutHeight: WidgetMeta = { ...meta, defaultHeight: undefined };
    expect(mdxSnippet(withoutHeight)).toContain(
      '<Interactive widget="demo-widget">',
    );
  });

  it("accepts a custom caption", () => {
    expect(mdxSnippet(meta, { caption: "Minha legenda." })).toContain(
      "\nMinha legenda.\n",
    );
  });

  it("can spell out every parameter as a starting point", () => {
    const full = mdxSnippet(meta, { allParams: true });
    expect(full).toContain('labels="true"');
    expect(full).toContain('name="A"');
    expect(full).toContain('size="2"');
  });

  it("skips a parameter whose default is nothing", () => {
    // `point=""` would be a parameter the author has to delete, not fill in.
    expect(mdxSnippet(meta, { allParams: true })).not.toContain("point=");
  });

  it("quotes every value, matching how directives parse", () => {
    const full = mdxSnippet(meta, { allParams: true });
    expect(full).not.toMatch(/=\{/);
    expect(full).not.toMatch(/=[^"]/);
  });

  it("round-trips through the real catalogue", () => {
    // A snippet that does not name a real widget would send the author to the
    // box's "unknown widget" error.
    for (const id of widgetIds()) {
      expect(mdxSnippet(catalog[id])).toContain(`widget="${id}"`);
    }
  });
});

describe("typeTokens", () => {
  it("gives one token for a scalar type", () => {
    expect(typeTokens(bool(true, "d"))).toEqual(["boolean"]);
    expect(typeTokens(num(1, "d"))).toEqual(["number"]);
    expect(typeTokens(str("a", "d"))).toEqual(["string"]);
  });

  it("spells a vector as the string an author types", () => {
    expect(typeTokens(vec3(null, "d"))).toEqual(['"x,y,z"']);
  });

  it("lists every allowed value for an enum", () => {
    expect(typeTokens(enumOf(["a", "b"] as const, "a", "d"))).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns a copy, so a consumer cannot mutate the schema", () => {
    const spec = enumOf(["a", "b"] as const, "a", "d");
    typeTokens(spec).push("c");
    expect(typeTokens(spec)).toEqual(["a", "b"]);
  });
});

describe("defaultToken", () => {
  it("renders scalars as text", () => {
    expect(defaultToken(bool(false, "d"))).toBe("false");
    expect(defaultToken(num(420, "d"))).toBe("420");
    expect(defaultToken(str("A", "d"))).toBe("A");
  });

  it("signals 'nothing to show' with null rather than an empty string", () => {
    // The callers render an em dash; "" would look like a real default.
    expect(defaultToken(vec3(null, "d"))).toBeNull();
  });

  it("renders a vector default the way an author would type it", () => {
    expect(defaultToken(vec3([1, 2, 3], "d"))).toBe('"1,2,3"');
  });
});
