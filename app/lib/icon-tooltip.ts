/**
 * lib/icon-tooltip.ts — the pure half of the site-wide icon-button tooltips
 * (components/layout/IconTooltips.tsx): which elements get one, with what
 * text, and where it goes on screen.
 */

/** Things a tooltip can describe. */
export const TOOLTIP_TARGETS =
  'button, a[href], summary, [role="button"], label[data-tooltip], th[data-tooltip]';

/** Where the element's own `title` waits while our tooltip stands in for it. */
export const HELD_TITLE = "data-held-title";

/** Text a sighted user can read on the element — ignores `sr-only` content. */
function visibleText(element: Element): string {
  let text = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) {
      text += node.textContent ?? "";
    } else if (node.nodeType === 1) {
      const child = node as Element;
      if (child.classList.contains("sr-only")) continue;
      if (child.getAttribute("aria-hidden") === "true") continue;
      text += visibleText(child);
    }
  }
  return text;
}

/**
 * The tooltip text for an element, or null when it should have none.
 *
 * An icon button is one that names itself (`aria-label`, or `title`) but
 * shows no words. A button with visible text already says what it does, so
 * it gets nothing — unless it asks with `data-tooltip="…"`. Any element can
 * opt out with `data-tooltip="off"`.
 */
export function tooltipLabelFor(element: Element): string | null {
  const explicit = element.getAttribute("data-tooltip");
  if (explicit === "off") return null;
  if (explicit) return explicit.trim() || null;

  if (element.hasAttribute("disabled")) return null;
  if (visibleText(element).trim() !== "") return null;

  const label =
    element.getAttribute("aria-label") ??
    element.getAttribute("title") ??
    element.getAttribute(HELD_TITLE);
  return label?.trim() || null;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const GAP = 6;
const MARGIN = 6;

/**
 * Top-left corner for a tooltip of `size`, centred under `target`. It flips
 * above when there is no room below, and slides sideways to stay on screen.
 */
export function placeTooltip(
  target: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number; side: "bottom" | "top" } {
  const below = target.top + target.height + GAP;
  const fitsBelow = below + size.height + MARGIN <= viewport.height;
  const above = target.top - GAP - size.height;
  const side = fitsBelow || above < MARGIN ? "bottom" : "top";

  const centred = target.left + target.width / 2 - size.width / 2;
  const maxLeft = Math.max(MARGIN, viewport.width - size.width - MARGIN);
  return {
    left: Math.round(Math.min(Math.max(centred, MARGIN), maxLeft)),
    top: Math.round(side === "bottom" ? below : above),
    side,
  };
}
