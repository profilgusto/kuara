/**
 * catalog.test.ts — invariants every interactive widget must satisfy.
 *
 * The catalogue is what authors read (via the generated guide section) and
 * what `InteractiveBox` trusts at render time. These checks run over whatever
 * is registered, so a widget added later inherits them for free.
 */
import { describe, it, expect } from "vitest";
import { catalog, widgetIds } from "./catalog";

describe("interactive widget catalogue", () => {
  it("is not empty", () => {
    expect(widgetIds().length).toBeGreaterThan(0);
  });

  it.each(widgetIds())("%s: key matches meta.id", (id) => {
    expect(catalog[id].id).toBe(id);
  });

  it.each(widgetIds())("%s: id is kebab-case and URL-safe", (id) => {
    // Ids live in authored content forever; a rename breaks every module
    // that uses it, so keep the shape narrow from the start.
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(widgetIds())("%s: has a title and a description", (id) => {
    expect(catalog[id].title.trim().length).toBeGreaterThan(0);
    expect(catalog[id].description.trim().length).toBeGreaterThan(10);
  });

  it.each(widgetIds())("%s: every parameter documents itself", (id) => {
    // An empty `describe` would silently produce a blank cell in the
    // authoring guide, which is how undocumented parameters happen.
    for (const [name, spec] of Object.entries(catalog[id].props)) {
      expect(spec.describe.trim(), `${id}.${name}`).not.toBe("");
    }
  });

  it.each(widgetIds())("%s: every default is itself a legal value", (id) => {
    // Round-tripping catches a default that the parser would reject —
    // e.g. num(1000) under a max of 900, which would warn on every render.
    for (const [name, spec] of Object.entries(catalog[id].props)) {
      const result = spec.parse(spec.default);
      expect(result.warning, `${id}.${name}`).toBeUndefined();
      expect(result.value, `${id}.${name}`).toEqual(spec.default);
    }
  });

  it.each(widgetIds())("%s: declares a sane default height", (id) => {
    const h = catalog[id].defaultHeight;
    if (h === undefined) return;
    expect(h).toBeGreaterThanOrEqual(160);
    expect(h).toBeLessThanOrEqual(900);
  });
});
