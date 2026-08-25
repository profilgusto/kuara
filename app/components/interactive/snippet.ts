/**
 * components/interactive/snippet.ts
 *
 * Builds the copy-paste MDX example for a widget, from its catalogue entry.
 *
 * Shared on purpose: the authoring guide's generated section and the Payload
 * admin's library view both hand the author a snippet, and two hand-written
 * versions would drift. Pure string work — no React, no Payload — so it stays
 * importable from `catalog.ts` without breaking that module's freedom from
 * runtime dependencies.
 */
import type { WidgetMeta } from "./catalog";
import type { PropSpec } from "./props";

export interface SnippetOptions {
  /** Placeholder body. The block's children are its caption. */
  caption?: string;
  /**
   * Include every parameter with its default, as a starting point to edit.
   * Off by default: the shortest correct example is the better first
   * impression, and the parameter table sits right next to it.
   */
  allParams?: boolean;
}

/** Directives stringify everything, so a snippet quotes every value. */
function attr(name: string, value: unknown): string {
  // A null default means "nothing to show". Emitting `point=""` would hand the
  // author a parameter to delete rather than one to fill in, so it is dropped.
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return ` ${name}="${value.join(",")}"`;
  return ` ${name}="${String(value)}"`;
}

export function mdxSnippet(
  meta: WidgetMeta,
  { caption, allParams = false }: SnippetOptions = {},
): string {
  let attrs = attr("widget", meta.id);

  if (meta.defaultHeight) attrs += attr("height", meta.defaultHeight);

  if (allParams) {
    for (const [name, spec] of Object.entries(meta.props)) {
      attrs += attr(name, spec.default);
    }
  }

  const body =
    caption ??
    "Caption shown below the block, and in place of it when printing.";

  return `<Interactive${attrs}>\n${body}\n</Interactive>`;
}

/**
 * How a parameter's type is spelled for a reader: one token normally, one per
 * allowed value for an enum.
 *
 * Returned as tokens rather than a finished string because the two consumers
 * decorate them differently — the guide wraps each in backticks and escapes
 * the separator for a Markdown table, the admin view renders them as chips.
 */
export function typeTokens(spec: PropSpec): string[] {
  if (spec.type === "enum" && spec.values) return [...spec.values];
  if (spec.type === "vec3") return ['"x,y,z"'];
  return [spec.type];
}

/** The default as a reader sees it, or `null` when there is nothing to show. */
export function defaultToken(spec: PropSpec): string | null {
  if (spec.default === null || spec.default === undefined) return null;
  if (Array.isArray(spec.default)) return `"${spec.default.join(",")}"`;
  return String(spec.default);
}
