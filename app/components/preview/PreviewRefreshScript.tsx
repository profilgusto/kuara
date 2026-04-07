"use client";

import { useEffect } from "react";

const SCROLL_KEY = "preview-scroll-y";
const SLIDE_KEY = "preview-slide-id";

/**
 * Client component that auto-refreshes the preview iframe
 * when Payload CMS sends a postMessage after an autosave or manual save.
 *
 * Payload v3 Live Preview sends messages of shape:
 *   { type: 'payload-live-preview', data: { ... } }
 *
 * We listen for those and reload the page so the server re-fetches
 * the latest draft content from the database.
 *
 * State preservation:
 * - Text mode: scroll position is saved to sessionStorage and restored after reload.
 * - Presentation mode: current slide ID is saved to sessionStorage so SlideDeck
 *   can restore it (URL hash alone is unreliable due to a race condition in SlideDeck).
 *
 * Used by both Module and Tessela preview pages.
 */
export function PreviewRefreshScript() {
  // On mount: restore scroll position after a text-mode reload
  useEffect(() => {
    const savedY = sessionStorage.getItem(SCROLL_KEY);
    if (savedY !== null) {
      sessionStorage.removeItem(SCROLL_KEY);
      const y = parseInt(savedY, 10);
      // Wait for the server-rendered content to fully paint before scrolling
      setTimeout(() => {
        try {
          window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
        } catch {
          window.scrollTo(0, y);
        }
      }, 200);
    }
  }, []);

  // Listen for Payload save/update messages
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;

    function handleMessage(event: MessageEvent) {
      // Payload Live Preview sends structured messages
      if (
        event.data &&
        typeof event.data === "object" &&
        (event.data.type === "payload-live-preview" ||
          event.data.type === "payload-update")
      ) {
        // Debounce refreshes to avoid rapid reloads during autosave
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const mode = localStorage.getItem("view-mode") || "texto";
          if (mode === "texto") {
            // Save scroll position so it can be restored after reload
            sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
          } else {
            // Save current slide ID from the URL hash.
            // SlideDeck updates the hash via replaceState as slides change.
            const hash = window.location.hash.replace(/^#/, "");
            if (hash) {
              sessionStorage.setItem(SLIDE_KEY, hash);
            }
          }
          window.location.reload();
        }, 1000);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(debounceTimer);
    };
  }, []);

  // ── Preview → Editor: click anywhere to jump Monaco to that source line ──
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      // Walk up the DOM from the click target to find the nearest element
      // stamped with data-source-line by the rehype-source-lines plugin.
      let el = event.target as HTMLElement | null;
      while (el && el !== document.body) {
        const line = el.dataset?.sourceLine;
        if (line) {
          const lineNum = parseInt(line, 10);
          if (!isNaN(lineNum)) {
            // Post to the parent frame (Payload admin panel)
            window.parent.postMessage(
              { type: "preview-goto-line", line: lineNum },
              "*",
            );
          }
          return;
        }
        el = el.parentElement;
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // ── Editor → Preview: receive editor-goto-line and scroll preview ──
  useEffect(() => {
    function handleEditorGoto(event: MessageEvent) {
      if (
        !event.data ||
        typeof event.data !== "object" ||
        event.data.type !== "editor-goto-line"
      )
        return;

      const targetLine = Number(event.data.line);
      if (isNaN(targetLine)) return;

      // Find the element stamped with the exact line, or walk upward to
      // the nearest element whose line is ≤ targetLine.
      const all = Array.from(
        document.querySelectorAll<HTMLElement>("[data-source-line]"),
      );
      if (!all.length) return;

      // Find the element whose source line is the closest ≤ targetLine
      let best: HTMLElement | null = null;
      let bestLine = -1;
      for (const el of all) {
        const n = parseInt(el.dataset.sourceLine!, 10);
        if (!isNaN(n) && n <= targetLine && n > bestLine) {
          best = el;
          bestLine = n;
        }
      }

      // Fallback: if targetLine is before the first stamped element, use the first
      if (!best && all.length) best = all[0];

      if (!best) return;

      // In presentation mode, navigate to the slide that contains the element.
      // SlideDeck listens for the "slidedeck:goto" custom event and switches slides.
      const mode = localStorage.getItem("view-mode") || "texto";
      if (mode === "apresentacao") {
        const slide = best.closest<HTMLElement>("section[data-id]");
        const slideId = slide?.dataset.id;
        if (slideId) {
          window.dispatchEvent(
            new CustomEvent("slidedeck:goto", { detail: { id: slideId } }),
          );
        }
        return;
      }

      best.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    window.addEventListener("message", handleEditorGoto);
    return () => window.removeEventListener("message", handleEditorGoto);
  }, []);

  return null;
}
