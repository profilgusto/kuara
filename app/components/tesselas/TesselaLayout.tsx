"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heading } from "@/lib/mdx-pipeline";
import { useNav } from "@/components/layout/NavContext";
import { useEqrefScroll, useEqrefPopover } from "@/lib/eqref-interactions";

// ── swipe-to-close panel ──────────────────────────────────────────────────────

function useSwipeToClosePanel(
  panelRef: React.RefObject<HTMLElement | null>,
  panelOpen: boolean,
  setPanelOpen: (open: boolean) => void,
) {
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !panelOpen) return;

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
        el!.style.transform = "translateX(calc(100% + 12px))";
        setTimeout(() => {
          setPanelOpen(false);
          el!.style.transform = "";
          el!.style.transition = "";
        }, 300);
      } else {
        el!.style.transition = "transform 300ms ease-in-out";
        el!.style.transform = "";
        setTimeout(() => {
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
  }, [panelRef, panelOpen, setPanelOpen]);
}

// ── TOC panel ─────────────────────────────────────────────────────────────────

function TocPanel({
  headings,
  onLinkClick,
}: {
  headings: Heading[];
  onLinkClick?: () => void;
}) {
  const [activeHeading, setActiveHeading] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" },
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">Sem seções.</p>
    );
  }

  return (
    <nav className="p-4 space-y-1 text-sm overflow-y-auto overscroll-contain h-full">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
        Sumário
      </p>
      <ul className="space-y-1">
        {headings.map((h) => {
          const isActive = activeHeading === h.id;
          return (
            <li
              key={h.id}

            >
              <a
                href={`#${h.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(h.id)
                    ?.scrollIntoView({ behavior: "smooth" });
                  history.pushState(null, "", `#${h.id}`);
                  onLinkClick?.();
                }}
                className={`block py-0.5 transition-colors line-clamp-2 ${
                  isActive
                    ? "font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

interface TesselaLayoutProps {
  headings: Heading[];
  tesselaTitle: string;
  children: ReactNode;
}

export function TesselaLayout({
  headings,
  tesselaTitle,
  children,
}: TesselaLayoutProps) {
  const { sidebarOpen, setSidebarOpen, setHasSidebar, setBreadcrumbs } =
    useNav();

  const popoverRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEqrefScroll();
  useEqrefPopover(popoverRef);
  useSwipeToClosePanel(panelRef, sidebarOpen, setSidebarOpen);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Tesselas", href: "/tesselas" },
      { label: tesselaTitle },
    ]);
    setHasSidebar(true);
    return () => {
      setBreadcrumbs([]);
      setHasSidebar(false);
      setSidebarOpen(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tesselaTitle]);

  return (
    <div className="flex flex-col">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSidebarOpen(false)}
      >
        <div className="absolute inset-0" />
      </div>

      {/* TOC panel — floats below root SiteNav */}
      <aside
        ref={panelRef}
        className={`fixed top-[4.5rem] right-3 bottom-3 z-50 w-72 rounded-xl bg-background/60 backdrop-blur border border-border/40 shadow-lg transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "translate-x-[calc(100%+12px)]"}`}
      >
        <ScrollArea className="h-full">
          <TocPanel
            headings={headings}
            onLinkClick={() => setSidebarOpen(false)}
          />
        </ScrollArea>
      </aside>

      {/* Equation reference popover */}
      <div
        ref={popoverRef}
        className="eq-popover fixed z-[60] px-4 py-3 rounded-xl bg-background/50 backdrop-blur-md border border-border/30 shadow-xl pointer-events-none"
      />

      {/* Main content */}
      <main className="flex-1 w-full min-w-0">
        <div className="container max-w-4xl mx-auto px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
