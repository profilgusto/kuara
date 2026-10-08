"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HELD_TITLE,
  TOOLTIP_TARGETS,
  placeTooltip,
  tooltipLabelFor,
} from "@/lib/icon-tooltip";

interface Shown {
  target: Element;
  text: string;
}

/**
 * A small label that appears at once under any icon-only button on hover (or
 * keyboard focus), saying what the button does.
 *
 * Mounted once, in the site layout, instead of wrapped around each button:
 * it listens on the document and describes whatever qualifies (see
 * `tooltipLabelFor`), so a new icon button gets its tooltip just by having an
 * `aria-label` — which it needs anyway. The browser's own `title` tooltip
 * would do the job, but only after a fixed delay nobody can tune; while ours
 * is up, the element's `title` is set aside so the two never stack.
 *
 * Purely visual: the text repeats the button's accessible name, so it is
 * hidden from assistive technology.
 */
export function IconTooltips() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(
    null,
  );
  const tip = useRef<HTMLDivElement>(null);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    function release() {
      const element = current.current;
      if (!element) return;
      const held = element.getAttribute(HELD_TITLE);
      // React may have written a newer title meanwhile; that one wins.
      if (held !== null && !element.hasAttribute("title")) {
        element.setAttribute("title", held);
      }
      element.removeAttribute(HELD_TITLE);
      current.current = null;
    }

    function hide() {
      release();
      setShown(null);
      setPlace(null);
    }

    function show(element: Element) {
      if (element === current.current) return;
      const text = tooltipLabelFor(element);
      release();
      if (!text) {
        setShown(null);
        setPlace(null);
        return;
      }
      const title = element.getAttribute("title");
      if (title !== null) {
        element.setAttribute(HELD_TITLE, title);
        element.removeAttribute("title");
      }
      current.current = element;
      setPlace(null);
      setShown({ target: element, text });
    }

    const targetOf = (node: EventTarget | null) =>
      node instanceof Element ? node.closest(TOOLTIP_TARGETS) : null;

    function onPointerOver(event: PointerEvent) {
      // A finger has no hover; the tooltip would stick after the tap.
      if (event.pointerType === "touch") return;
      const element = targetOf(event.target);
      if (element) show(element);
      else if (current.current) hide();
    }

    function onPointerOut(event: PointerEvent) {
      const element = current.current;
      if (!element) return;
      const next = event.relatedTarget;
      if (next instanceof Node && element.contains(next)) return;
      hide();
    }

    // Focus only brings a tooltip when it came from the keyboard: a click
    // also focuses, and must not bring back what `pointerdown` just hid.
    let byKeyboard = false;

    function onPointerDown() {
      byKeyboard = false;
      hide();
    }

    function onFocusIn(event: FocusEvent) {
      const element = targetOf(event.target);
      if (element && byKeyboard) show(element);
    }

    function onKeyDown(event: KeyboardEvent) {
      byKeyboard = true;
      if (event.key === "Escape") hide();
    }

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      release();
    };
  }, []);

  // Measured after render, placed before paint: no visible jump.
  useLayoutEffect(() => {
    if (!shown || !tip.current) return;
    // The button may have been removed by the very click that it handled.
    if (!shown.target.isConnected) {
      setShown(null);
      return;
    }
    const target = shown.target.getBoundingClientRect();
    const own = tip.current.getBoundingClientRect();
    const { left, top } = placeTooltip(
      target,
      { width: own.width, height: own.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPlace({ left, top });
  }, [shown]);

  if (!shown) return null;

  // In fullscreen (the slide deck) only that element's subtree is painted.
  const host = document.fullscreenElement ?? document.body;

  return createPortal(
    <div
      ref={tip}
      aria-hidden="true"
      data-icon-tooltip=""
      style={{
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        visibility: place ? "visible" : "hidden",
      }}
      className="pointer-events-none fixed z-[100] max-w-xs whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
    >
      {shown.text}
    </div>,
    host,
  );
}
