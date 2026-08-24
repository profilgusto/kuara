/**
 * citation-shared.test.ts — style classification shared by server and client.
 *
 * isNumericStyle decides whether a citation renders as [1] or (Autor, ano);
 * getting it wrong silently changes every citation in a document.
 */
import { describe, it, expect } from "vitest";
import {
  isNumericStyle,
  NUMERIC_STYLES,
  type CitationStyle,
} from "./citation-shared";

describe("isNumericStyle", () => {
  it.each(["numeric", "ieee", "vancouver"] as CitationStyle[])(
    "classifies %s as numeric",
    (style) => {
      expect(isNumericStyle(style)).toBe(true);
    },
  );

  it.each(["authoryear", "apa", "chicago"] as CitationStyle[])(
    "classifies %s as author-year",
    (style) => {
      expect(isNumericStyle(style)).toBe(false);
    },
  );

  it("agrees with the exported NUMERIC_STYLES list", () => {
    // The list is consumed directly elsewhere; the two must not drift apart.
    for (const style of NUMERIC_STYLES) {
      expect(isNumericStyle(style)).toBe(true);
    }
  });
});
