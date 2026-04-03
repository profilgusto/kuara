import { useEffect } from "react";

// ── shared helpers ────────────────────────────────────────────────────────────

/** Returns the decoded element id from an eqref anchor, or null. */
export function getEqrefId(link: Element): string | null {
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
export function findEqContainer(id: string): HTMLElement | null {
  const idEl =
    document.getElementById(id) ??
    document.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
  if (!idEl) return null;
  return (idEl.closest("mjx-container") as HTMLElement | null) ?? idEl;
}

// ── scroll + highlight on click ──────────────────────────────────────────────

export function useEqrefScroll() {
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

export function useEqrefPopover(popoverRef: React.RefObject<HTMLDivElement | null>) {
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
