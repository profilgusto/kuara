/**
 * props.test.ts — the coercion contract of the interactive-widget framework.
 *
 * These parsers sit between author-written Markdown and every widget, and the
 * directive form gives them nothing but strings. The cases below are written
 * against what authors actually type, including the malformed variants.
 */
import { describe, it, expect } from "vitest";
import { bool, enumOf, num, parseProps, str, vec3 } from "./props";

describe("str", () => {
  it("falls back to the default when the attribute is absent", () => {
    expect(str("A").parse(undefined).value).toBe("A");
    expect(str("A").parse(null).value).toBe("A");
  });

  it("treats an empty or whitespace-only value as absent", () => {
    expect(str("A").parse("").value).toBe("A");
    expect(str("A").parse("   ").value).toBe("A");
  });

  it("trims the authored value", () => {
    expect(str("A").parse("  B  ").value).toBe("B");
  });

  it("warns and falls back on a non-string", () => {
    const r = str("A").parse(42);
    expect(r.value).toBe("A");
    expect(r.warning).toMatch(/texto/);
  });
});

describe("bool", () => {
  it("falls back when absent", () => {
    expect(bool(true).parse(undefined).value).toBe(true);
    expect(bool(false).parse(undefined).value).toBe(false);
  });

  it('reads a valueless directive attribute ("{labels}" → "") as true', () => {
    // The whole point: `:::interactive{grid}` must switch grid ON even when
    // the widget's default is off.
    expect(bool(false).parse("").value).toBe(true);
    expect(bool(false).parse("  ").value).toBe(true);
  });

  it("accepts the truthy spellings authors use, in either language", () => {
    for (const raw of ["true", "1", "yes", "y", "sim", "on", "TRUE", " Sim "]) {
      expect(bool(false).parse(raw).value, raw).toBe(true);
    }
  });

  it("accepts the falsy spellings, accented or not", () => {
    for (const raw of ["false", "0", "no", "n", "nao", "não", "off", "FALSE"]) {
      expect(bool(true).parse(raw).value, raw).toBe(false);
    }
  });

  it("passes real JSX booleans and numbers through", () => {
    expect(bool(false).parse(true).value).toBe(true);
    expect(bool(true).parse(false).value).toBe(false);
    expect(bool(false).parse(1).value).toBe(true);
    expect(bool(true).parse(0).value).toBe(false);
  });

  it("warns and falls back on gibberish", () => {
    const r = bool(true).parse("talvez");
    expect(r.value).toBe(true);
    expect(r.warning).toMatch(/booleano/);
  });
});

describe("num", () => {
  it("falls back when absent or empty", () => {
    expect(num(420).parse(undefined).value).toBe(420);
    expect(num(420).parse("").value).toBe(420);
  });

  it("parses the string form a directive produces", () => {
    expect(num(420).parse("300").value).toBe(300);
    expect(num(420).parse(" 300 ").value).toBe(300);
    expect(num(420).parse("1.5").value).toBe(1.5);
  });

  it("passes the numeric form JSX produces", () => {
    expect(num(420).parse(300).value).toBe(300);
  });

  it("warns and falls back on a non-number", () => {
    const r = num(420).parse("alto");
    expect(r.value).toBe(420);
    expect(r.warning).toMatch(/numérico/);
  });

  it("rejects Infinity rather than sizing a box to it", () => {
    expect(num(420).parse(Infinity).warning).toBeDefined();
    expect(num(420).parse(Infinity).value).toBe(420);
  });

  it("clamps to the declared range and says so", () => {
    const spec = num(420, "", { min: 160, max: 900 });
    expect(spec.parse("10")).toEqual({
      value: 160,
      warning: expect.stringMatching(/mínimo/),
    });
    expect(spec.parse("5000")).toEqual({
      value: 900,
      warning: expect.stringMatching(/máximo/),
    });
    expect(spec.parse("420").warning).toBeUndefined();
  });

  it("rounds when the spec asks for an integer", () => {
    expect(num(0, "", { integer: true }).parse("12.6").value).toBe(13);
  });
});

describe("enumOf", () => {
  const spec = enumOf(["texto", "grade"] as const, "texto");

  it("matches case-insensitively", () => {
    expect(spec.parse("GRADE").value).toBe("grade");
  });

  it("falls back when absent", () => {
    expect(spec.parse(undefined).value).toBe("texto");
  });

  it("lists the valid values when the author misses", () => {
    const r = spec.parse("tabela");
    expect(r.value).toBe("texto");
    expect(r.warning).toContain("texto, grade");
  });
});

describe("vec3", () => {
  it("defaults to null when absent", () => {
    expect(vec3(null).parse(undefined).value).toBeNull();
  });

  it("parses commas, spaces, and both together", () => {
    expect(vec3(null).parse("1,2,3").value).toEqual([1, 2, 3]);
    expect(vec3(null).parse("1 2 3").value).toEqual([1, 2, 3]);
    expect(vec3(null).parse(" 1 ,  2,3 ").value).toEqual([1, 2, 3]);
  });

  it("handles negatives and decimals", () => {
    expect(vec3(null).parse("-1.5,0,0.75").value).toEqual([-1.5, 0, 0.75]);
  });

  it("accepts the array form from JSX", () => {
    expect(vec3(null).parse([1, 2, 3]).value).toEqual([1, 2, 3]);
  });

  it("warns on the wrong number of components", () => {
    const r = vec3(null).parse("1,2");
    expect(r.value).toBeNull();
    expect(r.warning).toMatch(/3 componentes/);
  });

  it("warns when a component is not a number", () => {
    const r = vec3(null).parse("1,dois,3");
    expect(r.value).toBeNull();
    expect(r.warning).toMatch(/não numéricas/);
  });
});

describe("parseProps", () => {
  const schema = {
    labels: bool(true),
    height: num(420, "", { min: 160 }),
    point: vec3(null),
  };

  it("returns every declared key, so a widget never sees undefined", () => {
    const { props } = parseProps(schema, {});
    expect(props).toEqual({ labels: true, height: 420, point: null });
  });

  it("coerces the all-strings bag a directive produces", () => {
    const { props, warnings } = parseProps(schema, {
      labels: "false",
      height: "300",
      point: "1,1,1",
    });
    expect(props).toEqual({ labels: false, height: 300, point: [1, 1, 1] });
    expect(warnings).toEqual([]);
  });

  it("prefixes each warning with the parameter it came from", () => {
    const { warnings } = parseProps(schema, { height: "alto" });
    expect(warnings).toEqual([expect.stringMatching(/^height: .*numérico/)]);
  });

  it("reports a misspelled parameter instead of silently dropping it", () => {
    const { warnings } = parseProps(schema, { label: "true" });
    expect(warnings).toContain("parâmetro desconhecido: label");
  });

  it("collects warnings from every offending key at once", () => {
    const { warnings } = parseProps(schema, {
      height: "alto",
      point: "1,2",
      cor: "azul",
    });
    expect(warnings).toHaveLength(3);
  });

  it("tolerates a missing attribute bag", () => {
    expect(parseProps(schema).props.labels).toBe(true);
  });
});
