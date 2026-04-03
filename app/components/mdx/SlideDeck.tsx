"use client";

import React, { useEffect, useRef, useState } from "react";
import { useViewMode } from "./useViewMode";
import {
  ChevronFirst,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  PanelRight,
  Plus,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import type { Heading } from "@/lib/mdx-pipeline";

export default function SlideDeck({
  children,
  headings = [],
}: {
  children: ReactNode;
  headings?: Heading[];
}) {
  const mode = useViewMode();
  const { theme, setTheme } = useTheme();
  const deckRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outerAreaRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(() => {
    // Read saved slide position synchronously at component creation.
    // This runs before any effects and before the first render, so there are
    // no timing races with the show/hide or collection effects.
    if (typeof window === "undefined") return 0;
    const storageKey = `slidedeck:slide:${window.location.pathname}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const { index: saved, savedAt } = JSON.parse(raw) as { index: number; savedAt: number };
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - savedAt < ONE_DAY && saved > 0) return saved;
        if (Date.now() - savedAt >= ONE_DAY) localStorage.removeItem(storageKey);
      }
    } catch { /* ignore */ }
    return 0;
  });
  const [ids, setIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsNavOpen, setFsNavOpen] = useState(false);
  const fsNavRef = useRef<HTMLElement | null>(null);
  // heading.id → slide index (built after ids settle, requires DOM lookup)
  const [headingSlideMap, setHeadingSlideMap] = useState<Map<string, number>>(new Map());
  const [contentScale, setContentScale] = useState(() => {
    if (typeof window === "undefined") return 1.0;
    const saved = localStorage.getItem("slidedeck:contentScale");
    const parsed = saved ? parseFloat(saved) : NaN;
    return isNaN(parsed) ? 1.0 : Math.min(2.0, Math.max(0.5, parsed));
  });

  const adjustContentScale = (delta: number) =>
    setContentScale((s) => {
      const next = Math.min(2.0, Math.max(0.5, Math.round((s + delta) * 10) / 10));
      localStorage.setItem("slidedeck:contentScale", String(next));
      return next;
    });

  // Keep a ref to the latest index so the unmount cleanup can always read it
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);

  // Persist slide index to localStorage (expires after 24h).
  // Two mechanisms:
  //   1. On every index change (normal navigation within the page)
  //   2. On unmount (catches within-app navigation where React may not have
  //      flushed the per-change effect before the component unmounts)
  useEffect(() => {
    if (ids.length === 0) return;
    const storageKey = `slidedeck:slide:${window.location.pathname}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ index, savedAt: Date.now() }));
    } catch {
      // ignore quota errors
    }
  }, [index, ids.length]);

  useEffect(() => {
    // Capture pathname at mount time — the URL may change before cleanup runs
    const pathname = window.location.pathname;
    return () => {
      if (indexRef.current <= 0) return;
      try {
        localStorage.setItem(
          `slidedeck:slide:${pathname}`,
          JSON.stringify({ index: indexRef.current, savedAt: Date.now() }),
        );
      } catch {
        // ignore quota errors
      }
    };
  }, []);

  // Zoom/pan state kept in a ref for synchronous access inside event handlers
  const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const [transform, setTransform] = useState({ zoom: 1, panX: 0, panY: 0 });

  const applyTransform = (
    fn: (t: typeof transformRef.current) => typeof transformRef.current,
  ) => {
    const next = fn(transformRef.current);
    transformRef.current = next;
    setTransform({ ...next });
  };

  // Collect slide sections (no DOM mutation, just reading)
  useEffect(() => {
    if (mode !== "apresentacao") return;
    const root = containerRef.current;
    if (!root) return;

    // Capture the hash NOW, synchronously, before the show/hide effect (which runs
    // after this one in the same commit) overwrites window.location.hash to slide 0.
    const initialHash = window.location.hash.replace(/^#/, "");

    // Wait a tick for DOM to be fully hydrated
    requestAnimationFrame(() => {
      const sections: HTMLElement[] = Array.from(
        root.querySelectorAll("section[data-id]"),
      );
      setIds(sections.map((s) => s.dataset.id || "").filter(Boolean));

      // After a preview reload, PreviewRefreshScript saves the current slide ID to
      // sessionStorage before window.location.reload(). We restore from there first
      // because the URL hash may be overwritten by the show/hide effect before we read it.
      const savedSlideId = sessionStorage.getItem("preview-slide-id");
      if (savedSlideId) {
        sessionStorage.removeItem("preview-slide-id");
        const idx = sections.findIndex((s) => s.dataset.id === savedSlideId);
        if (idx >= 0) {
          setIndex(idx);
          return;
        }
      }

      // Fall back to URL hash captured before show/hide could overwrite it
      if (initialHash) {
        const idx = sections.findIndex((s) => s.dataset.id === initialHash);
        if (idx >= 0) {
          setIndex(idx);
          return;
        }
      }

      // localStorage restore is handled synchronously in the useState initializer;
      // no async fallback needed here.
    });
  }, [mode, children]);

  // Navigate to a specific slide via custom event (e.g. from sidebar)
  useEffect(() => {
    if (mode !== "apresentacao") return;
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      const root = containerRef.current;
      if (!root) return;
      const sections: HTMLElement[] = Array.from(
        root.querySelectorAll("section[data-id]"),
      );
      const idx = sections.findIndex((s) => s.dataset.id === id);
      if (idx >= 0) setIndex(idx);
    };
    window.addEventListener("slidedeck:goto", handler);
    return () => window.removeEventListener("slidedeck:goto", handler);
  }, [mode]);

  // Keyboard navigation
  useEffect(() => {
    if (mode !== "apresentacao") return;
    const onKey = (e: KeyboardEvent) => {
      const max = Math.max(0, ids.length - 1);
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, max));
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Home") setIndex(0);
      if (e.key === "End") setIndex(max);
      if (e.key === "Escape" && isFullscreen) toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, isFullscreen, ids.length]);

  // Show/hide slides: cross-fade via opacity, all slides stacked absolutely
  useEffect(() => {
    if (mode !== "apresentacao") return;
    const root = containerRef.current;
    if (!root) return;
    const sections: HTMLElement[] = Array.from(
      root.querySelectorAll("section[data-id]"),
    );
    sections.forEach((el, idx) => {
      const show = idx === index;
      el.style.position = "absolute";
      el.style.inset = "0";
      el.style.overflowY = "auto";
      el.style.transition = "opacity 280ms ease-in-out";
      el.style.opacity = show ? "1" : "0";
      el.style.pointerEvents = show ? "" : "none";
      el.setAttribute("aria-hidden", show ? "false" : "true");
    });
    const activeSection = sections[index];
    if (activeSection) {
      const t = activeSection.dataset.title;
      if (t) setTitle(t);

      const id = activeSection.dataset.id;
      if (id) {
        const url = new URL(window.location.href);
        url.hash = id;
        window.history.replaceState({}, "", url.toString());
      }
      // Scroll active slide back to top
      activeSection.scrollTop = 0;
    }
    // Reset zoom/pan on slide change
    applyTransform(() => ({ zoom: 1, panX: 0, panY: 0 }));
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [index, mode, ids.length]);

  // 1-finger horizontal swipe
  useEffect(() => {
    if (mode !== "apresentacao") return;
    const el = outerAreaRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let swiping = false;
    let isHorizontalSwipe: boolean | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = true;
      isHorizontalSwipe = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!swiping || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      // Determine swipe direction once we have enough movement
      if (isHorizontalSwipe === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
      }
      // Block native horizontal scroll/pan so the sidebar never becomes visible
      if (isHorizontalSwipe) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!swiping) return;
      swiping = false;
      isHorizontalSwipe = null;
      const dx = (e.changedTouches[0]?.clientX || 0) - startX;
      const dy = (e.changedTouches[0]?.clientY || 0) - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const max = Math.max(0, ids.length - 1);
        if (dx < -50) setIndex((i) => Math.min(i + 1, max));
        else if (dx > 50) setIndex((i) => Math.max(i - 1, 0));
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    // non-passive so we can call preventDefault() and block horizontal native scroll
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [mode, ids.length]);

  // Swipe right to close fullscreen section navigator
  useEffect(() => {
    const el = fsNavRef.current;
    if (!el || !fsNavOpen) return;

    let startX = 0;
    let currentDx = 0;
    let tracking = false;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      currentDx = 0;
      tracking = true;
      el!.style.transition = "none";
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      if (dx < 0) {
        tracking = false;
        el!.style.transition = "";
        el!.style.transform = "";
        return;
      }
      currentDx = dx;
      el!.style.transform = `translateX(${dx}px)`;
      e.preventDefault();
    }

    function onTouchEnd() {
      if (!tracking) return;
      tracking = false;
      if (currentDx > 80) {
        el!.style.transition = "transform 300ms ease-in-out";
        el!.style.transform = "translateX(100%)";
        setTimeout(() => {
          setFsNavOpen(false);
          el!.style.transform = "";
          el!.style.transition = "";
        }, 300);
      } else {
        el!.style.transition = "transform 300ms ease-in-out";
        el!.style.transform = "translateX(0)";
        setTimeout(() => {
          el!.style.transform = "";
          el!.style.transition = "";
        }, 300);
      }
      currentDx = 0;
    }

    function onTouchCancel() {
      if (!tracking) return;
      tracking = false;
      el!.style.transition = "";
      el!.style.transform = "";
      currentDx = 0;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.style.transform = "";
      el.style.transition = "";
    };
  }, [fsNavOpen]);

  // Trackpad pinch-to-zoom (ctrlKey + wheel) and pan when zoomed in
  useEffect(() => {
    if (mode !== "apresentacao") return;
    const el = outerAreaRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        // Pinch-to-zoom: zoom centered on cursor position
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;

        applyTransform(({ zoom, panX, panY }) => {
          const factor = e.deltaY > 0 ? 0.95 : 1.05;
          const newZoom = Math.max(0.5, Math.min(4, zoom * factor));
          const ratio = newZoom / zoom;
          return {
            zoom: newZoom,
            panX: mx * (1 - ratio) + panX * ratio,
            panY: my * (1 - ratio) + panY * ratio,
          };
        });
      } else if (transformRef.current.zoom > 1) {
        // Pan when zoomed in (two-finger scroll without pinch)
        e.preventDefault();
        applyTransform(({ zoom, panX, panY }) => ({
          zoom,
          panX: panX - e.deltaX / zoom,
          panY: panY - e.deltaY / zoom,
        }));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mode]);

  // Double-click to reset zoom/pan
  useEffect(() => {
    if (mode !== "apresentacao") return;
    const el = outerAreaRef.current;
    if (!el) return;
    const onDblClick = () =>
      applyTransform(() => ({ zoom: 1, panX: 0, panY: 0 }));
    el.addEventListener("dblclick", onDblClick);
    return () => el.removeEventListener("dblclick", onDblClick);
  }, [mode]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      deckRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) setFsNavOpen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Build heading → slide index map after ids are collected
  useEffect(() => {
    if (ids.length === 0 || headings.length === 0) return;
    const root = containerRef.current;
    if (!root) return;
    const map = new Map<string, number>();
    headings.forEach((h) => {
      const el = root.querySelector(`[id="${CSS.escape(h.id)}"]`);
      const slideId = el?.closest("section[data-id]")?.getAttribute("data-id");
      if (slideId) {
        const idx = ids.indexOf(slideId);
        if (idx >= 0) map.set(h.id, idx);
      }
    });
    setHeadingSlideMap(map);
  }, [ids, headings]);

  if (mode !== "apresentacao") {
    return <div ref={containerRef}>{children}</div>;
  }

  const progress = ids.length > 1 ? (index / (ids.length - 1)) * 100 : 0;
  const isZoomed = transform.zoom !== 1;

  return (
    <div
      ref={deckRef}
      className={`presentation-deck relative mx-auto w-full bg-background flex flex-col min-h-[500px] overflow-hidden ${isFullscreen ? "h-screen" : "h-[600px]"}`}
      data-fullscreen={isFullscreen}
      style={{ "--slide-content-scale": contentScale } as React.CSSProperties}
    >
      <div className="sticky top-0 z-30 h-1 w-full bg-muted shrink-0">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="sticky top-1 z-20 w-full border-b bg-background/85 backdrop-blur flex items-center gap-3 px-3 h-10 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" title={title}>
            {title}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFullscreen && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => adjustContentScale(-0.1)}
                aria-label="Diminuir conteúdo"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs font-mono opacity-70 tabular-nums w-10 text-center select-none">
                {Math.round(contentScale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => adjustContentScale(+0.1)}
                aria-label="Aumentar conteúdo"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />
            </>
          )}
          {isZoomed && (
            <button
              className="text-xs font-mono opacity-60 hover:opacity-100 transition-opacity tabular-nums"
              onClick={() =>
                applyTransform(() => ({ zoom: 1, panX: 0, panY: 0 }))
              }
              title="Resetar zoom (ou duplo clique)"
              aria-label="Resetar zoom"
            >
              {Math.round(transform.zoom * 100)}%
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIndex(0)}
            aria-label="Primeiro slide"
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs font-medium opacity-70 tabular-nums w-14 text-center select-none">
            {ids.length ? index + 1 : 0}/{ids.length || 0}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              setIndex((i) => Math.min(i + 1, Math.max(0, ids.length - 1)))
            }
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}

          {isFullscreen && headings.length > 0 && (
            <>
              <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />
              <Button
                variant={fsNavOpen ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setFsNavOpen((v) => !v)}
                aria-label="Navegação de seções"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Fullscreen section navigator */}
      {isFullscreen && headings.length > 0 && (
        <aside
          ref={fsNavRef}
          className={`absolute right-0 bottom-0 z-20 w-60 bg-background/90 backdrop-blur border-l border-border/40 overflow-y-auto transition-transform duration-300 ease-in-out ${fsNavOpen ? "translate-x-0" : "translate-x-full"}`}
          aria-hidden={!fsNavOpen}
          style={{
            top: "calc(0.25rem + 2.5rem)",
            fontSize: "calc(1rem * var(--slide-content-scale, 1))",
          }}
        >
          <ul className="p-3 space-y-1 text-sm">
            {headings.map((h) => {
              const slideIdx = headingSlideMap.get(h.id);
              const isActive = slideIdx === index;
              return (
                <li key={h.id}>
                  <button
                    className={`w-full text-left px-2 py-1.5 rounded-md transition-colors line-clamp-2 ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      if (slideIdx !== undefined) setIndex(slideIdx);
                    }}
                  >
                    {h.text}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      <div
        ref={outerAreaRef}
        className="flex-1 relative overflow-hidden"
        suppressHydrationWarning
      >
        <div
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: "center center",
            width: "100%",
            height: "100%",
            willChange: "transform",
            cursor: isZoomed ? "grab" : undefined,
          }}
        >
          <div ref={containerRef} className="absolute inset-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
