"use client";

/**
 * <RefEq label="eq-xyz" />
 *
 * Renders an inline "Eq. N" link that mirrors <RefFig>:
 *  - On hover: shows a popover with the rendered equation
 *  - On click: smooth-scrolls to the equation and flashes a highlight animation
 *
 * Unlike figures, equation numbering is not seeded from the MDX source: it is
 * MathJax that assigns the numbers at render time, stamping each numbered row
 * with an `mjx-eqn:*` id. So the number is read from the DOM after mount —
 * see lib/equations.ts. Degrades gracefully to "[Eq.?]" if the label is not
 * found.
 */

import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { eqElementId } from "@/lib/equations";
import {
  findEqContainer,
  readEquationNumber,
  scrollToEquation,
} from "@/lib/eqref-interactions";

interface RefEqProps {
  label: string;
}

export default function RefEq({ label }: RefEqProps) {
  const elementId = eqElementId(label);
  // null until the post-mount measurement runs; -1 once it ran and found
  // nothing. Keeping the two apart avoids flashing the "not found" marker
  // during SSR and the first client render, when no number can exist yet.
  const [number, setNumber] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  // MathJax output is server-rendered, so the ids exist by the time this
  // effect runs. Re-run if the label changes.
  useEffect(() => {
    setNumber(readEquationNumber(elementId));
  }, [elementId]);

  if (number === null) {
    // SSR / pre-measurement placeholder — same footprint as the resolved link.
    return <span className="text-muted-foreground">Eq. …</span>;
  }

  if (number === -1) {
    return <span className="text-muted-foreground">[Eq.{label}?]</span>;
  }

  const eqText = `Eq. ${number}`;

  const handleClick = () => scrollToEquation(elementId);

  const handleMouseEnter = () => {
    const container = findEqContainer(elementId);
    const svg = container?.querySelector("svg");
    if (!svg) return;

    // Clone the equation SVG for the preview. Strip the mjx-eqn:* ids from
    // the clone — leaving them would make document.getElementById resolve to
    // the clone instead of the real equation, breaking scroll and highlight.
    const clone = svg.cloneNode(true) as SVGElement;
    clone
      .querySelectorAll("[id^='mjx-eqn']")
      .forEach((el) => el.removeAttribute("id"));

    setSvgHtml(clone.outerHTML);
    setOpen(true);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setOpen(false)}
          onClick={handleClick}
          className="inline cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Ir para ${eqText}`}
        >
          {eqText}
        </button>
      </Popover.Trigger>

      {svgHtml && (
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="center"
            sideOffset={8}
            avoidCollisions
            collisionPadding={16}
            // Prevent the popover itself from triggering onMouseLeave on the button
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className={[
              "z-[60] rounded-xl border border-border/40 shadow-xl",
              "bg-background/60 backdrop-blur-md",
              "px-4 py-3 max-w-[90vw] overflow-x-auto",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=top]:slide-in-from-bottom-2",
              "data-[side=bottom]:slide-in-from-top-2",
            ].join(" ")}
          >
            <div
              className="eq-preview"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
            <Popover.Arrow className="fill-background/80" />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}
