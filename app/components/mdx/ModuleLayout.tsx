"use client";

import { useEffect, useRef, ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CourseSidebar } from "./CourseSidebar";
import { CourseDetail } from "@/lib/payload-content";
import { Heading } from "@/lib/mdx-pipeline";
import { useNav } from "@/components/layout/NavContext";

// ── swipe-to-close sidebar ────────────────────────────────────────────────────

function useSwipeToCloseSidebar(
  sidebarRef: React.RefObject<HTMLElement | null>,
  sidebarOpen: boolean,
  setSidebarOpen: (open: boolean) => void,
) {
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el || !sidebarOpen) return;

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
        // Leftward drag — cancel tracking, restore CSS transition
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
        // Animate out, then update state
        el!.style.transition = "transform 300ms ease-in-out";
        el!.style.transform = "translateX(calc(100% + 12px))";
        setTimeout(() => {
          setSidebarOpen(false);
          el!.style.transform = "";
          el!.style.transition = "";
        }, 300);
      } else {
        // Snap back to open position
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
  }, [sidebarRef, sidebarOpen, setSidebarOpen]);
}

// ── shared helper ────────────────────────────────────────────────────────────

/** Returns the decoded element id from an eqref anchor, or null. */
function getEqrefId(link: Element): string | null {
  const rawHref =
    link.getAttribute("href") ??
    link.getAttributeNS("http://www.w3.org/1999/xlink", "href");
  if (!rawHref) return null;
  const hash = rawHref.indexOf("#");
  if (hash === -1) return null;
  const fragment = rawHref.slice(hash); // "#mjx-eqn%3A..."
  if (!fragment.startsWith("#mjx-eqn")) return null;
  return decodeURIComponent(fragment.slice(1)); // "mjx-eqn:label"
}

/** Finds the mjx-container for a given decoded eqref id. */
function findEqContainer(id: string): HTMLElement | null {
  const idEl =
    document.getElementById(id) ??
    document.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
  if (!idEl) return null;
  return (idEl.closest("mjx-container") as HTMLElement | null) ?? idEl;
}

// ── scroll + highlight on click ──────────────────────────────────────────────

function useEqrefScroll() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const link = (e.target as Element).closest<Element>("a");
      if (!link) return;
      const id = getEqrefId(link);
      if (!id) return;

      e.preventDefault();

      const target = findEqContainer(id);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      window.scrollTo({
        top: window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2,
        behavior: "smooth",
      });

      target.classList.remove("eq-highlight-active");
      void target.offsetWidth;
      target.classList.add("eq-highlight-active");
      target.addEventListener(
        "animationend",
        () => target.classList.remove("eq-highlight-active"),
        { once: true },
      );
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}

// ── hover popover ─────────────────────────────────────────────────────────────

function useEqrefPopover(popoverRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let activeLink: Element | null = null;

    function showPopover(link: Element) {
      const id = getEqrefId(link);
      if (!id) return;
      const container = findEqContainer(id);
      if (!container) return;
      const svg = container.querySelector("svg");
      if (!svg) return;

      const popover = popoverRef.current;
      if (!popover) return;

      // Clone the equation SVG and mount it.
      // Strip mjx-eqn:* IDs from the clone — leaving them causes
      // document.getElementById to return the clone instead of the original
      // equation on subsequent interactions, breaking scroll and highlight.
      const clone = svg.cloneNode(true) as SVGElement;
      clone.querySelectorAll("[id^='mjx-eqn']").forEach((el) => el.removeAttribute("id"));
      popover.innerHTML = "";
      popover.appendChild(clone);

      // Position above the link (fixed, viewport-relative)
      const rect = link.getBoundingClientRect();
      popover.style.left = `${rect.left + rect.width / 2}px`;
      popover.style.top = `${rect.top - 10}px`;
      popover.style.transform = "translate(-50%, -100%)";
      popover.classList.add("eq-popover-visible");

      // Flip below if the popover would go off the top of the screen
      requestAnimationFrame(() => {
        const pr = popover.getBoundingClientRect();
        if (pr.top < 8) {
          popover.style.top = `${rect.bottom + 10}px`;
          popover.style.transform = "translate(-50%, 0)";
        }
        // Clamp horizontal position within the viewport
        const pr2 = popover.getBoundingClientRect();
        if (pr2.right > window.innerWidth - 8) {
          popover.style.left = `${window.innerWidth - 8 - pr2.width / 2}px`;
        }
        if (pr2.left < 8) {
          popover.style.left = `${8 + pr2.width / 2}px`;
        }
      });
    }

    function hidePopover() {
      const popover = popoverRef.current;
      if (!popover) return;
      popover.classList.remove("eq-popover-visible");
    }

    function handleMouseOver(e: MouseEvent) {
      const link = (e.target as Element).closest<Element>("a");
      if (!link || !getEqrefId(link)) {
        if (activeLink) {
          activeLink = null;
          hidePopover();
        }
        return;
      }
      if (link === activeLink) return;
      activeLink = link;
      showPopover(link);
    }

    function handleMouseOut(e: MouseEvent) {
      const link = (e.target as Element).closest<Element>("a");
      if (!link || link !== activeLink) return;
      const related = e.relatedTarget as Node | null;
      if (related && link.contains(related)) return; // still inside the link
      activeLink = null;
      hidePopover();
    }

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, [popoverRef]);
}

// ── component ─────────────────────────────────────────────────────────────────

interface ModuleLayoutProps {
  course: CourseDetail;
  currentModuleSlug: string;
  headings: Heading[];
  courseTitle: string;
  courseSlug: string;
  moduleTitle: string;
  children: ReactNode;
}

export function ModuleLayout({
  course,
  currentModuleSlug,
  headings,
  courseTitle,
  courseSlug,
  moduleTitle,
  children,
}: ModuleLayoutProps) {
  const { sidebarOpen, setSidebarOpen, setHasSidebar, setBreadcrumbs } =
    useNav();

  const popoverRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEqrefScroll();
  useEqrefPopover(popoverRef);
  useSwipeToCloseSidebar(sidebarRef, sidebarOpen, setSidebarOpen);

  useEffect(() => {
    setBreadcrumbs([
      { label: courseTitle, href: `/disciplinas/${courseSlug}` },
      { label: moduleTitle },
    ]);
    setHasSidebar(true);
    return () => {
      setBreadcrumbs([]);
      setHasSidebar(false);
      setSidebarOpen(false);
    };
    // state setters from useState are stable — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseTitle, courseSlug, moduleTitle]);

  return (
    <div className="flex flex-col">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSidebarOpen(false)}
      >
        <div className="absolute inset-0" />
      </div>

      {/* Sidebar panel — floats below root SiteNav */}
      <aside
        ref={sidebarRef}
        className={`fixed top-[4.5rem] right-3 bottom-3 z-50 w-72 rounded-xl bg-background/60 backdrop-blur border border-border/40 shadow-lg transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "translate-x-[calc(100%+12px)]"}`}
      >
        <ScrollArea className="h-full">
          <CourseSidebar
            course={course}
            currentModuleSlug={currentModuleSlug}
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
