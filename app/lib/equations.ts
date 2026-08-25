/**
 * lib/equations.ts — Equation reference helpers.
 *
 * MathJax (`tags: "ams"`) stamps every *numbered* equation row with an id of
 * the form `mjx-eqn:<label>` when the author wrote `\label{...}`, or
 * `mjx-eqn:<N>` when they did not. Those ids appear in the rendered document
 * in the same order MathJax numbered them, so the equation number of a label
 * is simply its position among all `mjx-eqn*` ids.
 *
 * Pure utilities — no DOM, no server-only constraint, safe to import anywhere.
 */

/** Prefix used by MathJax on every numbered-equation element id. */
export const EQ_ID_PREFIX = "mjx-eqn:";

/**
 * Normalises an author-written label to the `eq:` namespace used by the
 * "Equação Numerada" snippet, so `<RefEq label="massa" />` and
 * `<RefEq label="eq:massa" />` both point at `\label{eq:massa}`.
 */
export function normalizeEqLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed.startsWith("eq:") ? trimmed : `eq:${trimmed}`;
}

/** The DOM element id MathJax gives the equation carrying `label`. */
export function eqElementId(label: string): string {
  return `${EQ_ID_PREFIX}${normalizeEqLabel(label)}`;
}

/**
 * Given every `mjx-eqn*` element id in document order, returns the 1-based
 * equation number for `elementId`, or -1 when it is not among them.
 */
export function equationNumber(
  orderedIds: readonly string[],
  elementId: string,
): number {
  const idx = orderedIds.indexOf(elementId);
  return idx === -1 ? -1 : idx + 1;
}
