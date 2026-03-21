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

  return null;
}
