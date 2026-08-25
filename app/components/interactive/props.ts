/**
 * components/interactive/props.ts
 *
 * Attribute coercion for the interactive-widget framework.
 *
 * A widget's parameters reach us through two authoring forms that disagree
 * about types:
 *
 *   <Interactive widget="x" height={420} labels />   → real JS values
 *   :::interactive{widget="x" height=420 labels}     → ALWAYS strings
 *
 * `remark-directive-to-mdx` stringifies every directive attribute
 * (`value: String(value)`), and a valueless attribute arrives as `""`.
 * These parsers normalise both shapes into typed values, falling back to the
 * declared default — with a warning the box can surface to the author —
 * whenever the input is unusable.
 */

export type PropType = "string" | "number" | "boolean" | "vec3" | "enum";

export interface ParseResult<T> {
  value: T;
  /** Author-facing message, in Portuguese, when the raw input was rejected. */
  warning?: string;
}

export interface PropSpec<T = unknown> {
  readonly type: PropType;
  readonly default: T;
  /** One-line description, reused verbatim by the authoring-guide generator. */
  readonly describe: string;
  /** Allowed values, for `enumOf` — also reused by the guide generator. */
  readonly values?: readonly string[];
  parse(raw: unknown): ParseResult<T>;
}

export type PropSchema = Record<string, PropSpec>;

/** `true` when the attribute was omitted entirely (as opposed to left empty). */
function isAbsent(raw: unknown): boolean {
  return raw === undefined || raw === null;
}

// ─── string ───────────────────────────────────────────────────────────────────

export function str(defaultValue: string, describe = ""): PropSpec<string> {
  return {
    type: "string",
    default: defaultValue,
    describe,
    parse(raw) {
      if (isAbsent(raw)) return { value: defaultValue };
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        return { value: trimmed === "" ? defaultValue : trimmed };
      }
      return {
        value: defaultValue,
        warning: `esperava um texto, recebeu ${typeof raw}`,
      };
    },
  };
}

// ─── boolean ──────────────────────────────────────────────────────────────────

const TRUTHY = new Set(["true", "1", "yes", "y", "sim", "on"]);
const FALSY = new Set(["false", "0", "no", "n", "nao", "não", "off"]);

export function bool(defaultValue: boolean, describe = ""): PropSpec<boolean> {
  return {
    type: "boolean",
    default: defaultValue,
    describe,
    parse(raw) {
      if (isAbsent(raw)) return { value: defaultValue };
      if (typeof raw === "boolean") return { value: raw };
      if (typeof raw === "number") return { value: raw !== 0 };
      if (typeof raw === "string") {
        // A valueless directive attribute (`{labels}`) arrives as "" and reads
        // as the JSX shorthand `labels`, i.e. an assertion that it is on.
        if (raw === "") return { value: true };
        const norm = raw.trim().toLowerCase();
        if (norm === "") return { value: true };
        if (TRUTHY.has(norm)) return { value: true };
        if (FALSY.has(norm)) return { value: false };
      }
      return {
        value: defaultValue,
        warning: `valor booleano inválido (${JSON.stringify(raw)})`,
      };
    },
  };
}

// ─── number ───────────────────────────────────────────────────────────────────

export interface NumOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

export function num(
  defaultValue: number,
  describe = "",
  { min, max, integer = false }: NumOptions = {},
): PropSpec<number> {
  return {
    type: "number",
    default: defaultValue,
    describe,
    parse(raw) {
      if (isAbsent(raw) || raw === "") return { value: defaultValue };

      let parsed: number;
      if (typeof raw === "number") parsed = raw;
      else if (typeof raw === "string") parsed = Number(raw.trim());
      else parsed = NaN;

      if (!Number.isFinite(parsed)) {
        return {
          value: defaultValue,
          warning: `valor numérico inválido (${JSON.stringify(raw)})`,
        };
      }

      if (integer) parsed = Math.round(parsed);

      // Out of range is an author mistake worth reporting, but a clamped value
      // still renders something usable — better than silently falling back.
      if (min !== undefined && parsed < min) {
        return { value: min, warning: `${parsed} abaixo do mínimo (${min})` };
      }
      if (max !== undefined && parsed > max) {
        return { value: max, warning: `${parsed} acima do máximo (${max})` };
      }

      return { value: parsed };
    },
  };
}

// ─── enum ─────────────────────────────────────────────────────────────────────

export function enumOf<T extends string>(
  values: readonly T[],
  defaultValue: T,
  describe = "",
): PropSpec<T> {
  return {
    type: "enum",
    default: defaultValue,
    describe,
    values,
    parse(raw) {
      if (isAbsent(raw) || raw === "") return { value: defaultValue };
      if (typeof raw === "string") {
        const norm = raw.trim().toLowerCase();
        const hit = values.find((v) => v.toLowerCase() === norm);
        if (hit) return { value: hit };
      }
      return {
        value: defaultValue,
        warning: `valor inválido (${JSON.stringify(raw)}); use um de: ${values.join(", ")}`,
      };
    },
  };
}

// ─── vec3 ─────────────────────────────────────────────────────────────────────

export type Vec3 = [number, number, number];

/**
 * A 3-component vector, authored as "x,y,z" (commas and/or whitespace).
 * `null` is a legitimate default, meaning "nothing to place".
 */
export function vec3(
  defaultValue: Vec3 | null,
  describe = "",
): PropSpec<Vec3 | null> {
  return {
    type: "vec3",
    default: defaultValue,
    describe,
    parse(raw) {
      if (isAbsent(raw) || raw === "") return { value: defaultValue };

      let parts: unknown[];
      if (Array.isArray(raw)) parts = raw;
      else if (typeof raw === "string") parts = raw.trim().split(/[\s,]+/);
      else
        return {
          value: defaultValue,
          warning: `esperava "x,y,z", recebeu ${typeof raw}`,
        };

      if (parts.length !== 3) {
        return {
          value: defaultValue,
          warning: `esperava 3 componentes em "x,y,z", recebeu ${parts.length}`,
        };
      }

      const nums = parts.map((p) =>
        Number(typeof p === "string" ? p.trim() : p),
      );
      if (!nums.every((n) => Number.isFinite(n))) {
        return {
          value: defaultValue,
          warning: `componentes não numéricas em ${JSON.stringify(raw)}`,
        };
      }

      return { value: [nums[0], nums[1], nums[2]] as Vec3 };
    },
  };
}

// ─── schema application ───────────────────────────────────────────────────────

export interface ParsedProps {
  props: Record<string, unknown>;
  /** `"height: valor numérico inválido (\"alto\")"`, ready to show the author. */
  warnings: string[];
}

/**
 * Apply a schema to a raw attribute bag.
 *
 * Every key declared in the schema is present in the output — a widget never
 * has to defend against `undefined`. Keys the schema does not declare are
 * dropped and reported, which is how an author finds out they typed
 * `label` when the widget wanted `labels`.
 */
export function parseProps(
  schema: PropSchema,
  raw: Record<string, unknown> = {},
): ParsedProps {
  const props: Record<string, unknown> = {};
  const warnings: string[] = [];

  for (const [key, spec] of Object.entries(schema)) {
    const { value, warning } = spec.parse(raw[key]);
    props[key] = value;
    if (warning) warnings.push(`${key}: ${warning}`);
  }

  for (const key of Object.keys(raw)) {
    if (!(key in schema)) {
      warnings.push(`parâmetro desconhecido: ${key}`);
    }
  }

  return { props, warnings };
}
