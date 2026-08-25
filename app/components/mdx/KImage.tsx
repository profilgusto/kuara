"use client";
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useContext,
} from "react";
import { useViewMode } from "./useViewMode";
import { FiguresContext } from "@/components/figures/FiguresContext";
import { resolveMediaUrl } from "@/lib/base-path";

interface KImageProps {
  url?: string;
  src?: string;
  /**
   * Accessibility alt text for screen readers.
   * Backward-compat: if neither `caption` nor `label` are set,
   * `alt` is also displayed as the visible caption.
   */
  alt?: string;
  /**
   * Plain-text caption. For rich captions (with <Cite /> etc.), use children instead.
   * When combined with `label`, renders as "Fig. N — caption".
   */
  caption?: string;
  /**
   * Rich caption content (JSX). Use instead of `caption` when you need inline
   * components such as <Cite />. Works across the RSC→client boundary because
   * children are composed, not serialized as props.
   */
  children?: React.ReactNode;
  /**
   * Unique label for this figure. When set:
   *  - The figure is numbered ("Fig. N") in document order.
   *  - An `id="fig-{label}"` anchor is added for cross-references.
   *  - <RefFig label="..." /> can link to this figure inline.
   */
  label?: string;
  width?: string | number;
  widthPresentation?: string | number | "auto";
  // We keep height on the interface so existing MDX won't throw TS errors if they pass it,
  // but we ignore it to force aspect ratio.
  height?: string | number;
  heightPresentation?: string | number;
  align?: "left" | "center" | "right";
  className?: string;
}

export default function KImage({
  url,
  src,
  alt = "",
  caption,
  children,
  label,
  width,
  widthPresentation,
  align = "center",
  className,
}: KImageProps) {
  const mode = useViewMode();
  const rawSrc = url || src;
  const imageSrc = rawSrc ? resolveMediaUrl(rawSrc) : rawSrc;

  // ── Figure numbering (optional — degrades gracefully without FiguresProvider) ──
  const figuresCtx = useContext(FiguresContext);
  const figNum = label && figuresCtx ? figuresCtx.indexOfLabel(label) : -1;

  // Register src + caption in context so RefFig can show a hover preview
  const registerMetadata = figuresCtx?.registerMetadata;
  useEffect(() => {
    if (!label || !registerMetadata) return;
    registerMetadata(label, {
      src: imageSrc ?? "",
      captionText: typeof caption === "string" ? caption : "",
    });
  }, [label, imageSrc, caption, registerMetadata]);

  // ── Caption display logic ──────────────────────────────────────────────────
  // `alt` is strictly for screen readers (<img alt={alt}>), never shown visually.
  // `children` takes priority for rich captions (JSX/Cite); `caption` for plain text.
  const displayCaption = children ?? caption ?? "";
  const hasFigNum = figNum > 0;
  const showFigcaption = hasFigNum || !!displayCaption;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Safe initial state: constrain to container width to avoid overflow before first measurement
  const [autoStyle, setAutoStyle] = useState<React.CSSProperties>({
    maxWidth: "100%",
    height: "auto",
  });

  const isAutoMode = mode === "apresentacao" && widthPresentation === "auto";

  /**
   * Computes the optimal image dimensions for `widthPresentation="auto"`.
   *
   * Vertical boundary — we use the nearest scroll container's CLIENT height
   * (not the section's natural bottom). This is the key invariant that prevents
   * the image from growing the section and causing scroll:
   *
   *   availableHeight = scrollContainer.clientHeight
   *                     − (wrapper.top − scrollContainer.top)  [wrapper offset]
   *                     − section.paddingBottom                [breathing room]
   *
   * Horizontal boundary — width of the closest content container:
   *   .slide-second-col-content | .slide-main-content | .slide-layout-vertical
   *
   * If height-constrained (tall container with wide image): fix height, auto width.
   * If width-constrained: fix width, auto height.
   * Aspect ratio is always preserved.
   */
  const computeAutoLayout = useCallback(() => {
    const wrapper = wrapperRef.current;
    const img = imgRef.current;
    if (!wrapper || !img || !img.naturalWidth || !img.naturalHeight) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    // Guard: element is hidden (display:none collapses it to 0×0)
    if (wrapperRect.width === 0 && wrapperRect.height === 0) return;

    const section = wrapper.closest("section[data-id]") as HTMLElement | null;
    if (!section || section.style.display === "none") return;

    // Walk up to find the nearest scroll container.
    // In embedded mode: the section itself has overflow-y:auto (set by SlideDeck).
    // In fullscreen mode: the presentation-deck div (overflow-y: auto via CSS).
    let scrollEl: HTMLElement | null = section;
    while (scrollEl && scrollEl !== document.documentElement) {
      const cs = window.getComputedStyle(scrollEl);
      if (cs.overflowY === "auto" || cs.overflowY === "scroll") break;
      scrollEl = scrollEl.parentElement;
    }
    if (!scrollEl || scrollEl === document.documentElement) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    // clientHeight is the *visible* height — unaffected by scrollable content inside.
    const visibleBottom = scrollRect.top + scrollEl.clientHeight;

    // Preserve the slide's bottom padding as visual breathing room
    const pb = parseFloat(window.getComputedStyle(section).paddingBottom);

    // Horizontal: use the nearest content container's rendered width
    const containerEl = (wrapper.closest(".slide-second-col-content") ??
      wrapper.closest(".slide-main-content") ??
      wrapper.closest(".slide-layout-vertical")) as HTMLElement | null;

    const availableWidth = containerEl
      ? containerEl.getBoundingClientRect().width
      : (() => {
          const ss = window.getComputedStyle(section);
          return (
            section.getBoundingClientRect().width -
            parseFloat(ss.paddingLeft) -
            parseFloat(ss.paddingRight)
          );
        })();

    const availableHeight = visibleBottom - wrapperRect.top - pb;

    if (availableHeight <= 0 || availableWidth <= 0) {
      setAutoStyle({ maxWidth: "100%", height: "auto" });
      return;
    }

    const aspect = img.naturalWidth / img.naturalHeight;
    const widthIfHeightConstrained = availableHeight * aspect;

    if (widthIfHeightConstrained <= availableWidth) {
      // Bottom of scroll area reached before full width — constrain by height
      setAutoStyle({
        height: `${availableHeight}px`,
        width: "auto",
        maxWidth: `${availableWidth}px`,
        display: "block",
      });
    } else {
      // Width limit is the binding constraint
      setAutoStyle({
        width: `${availableWidth}px`,
        height: "auto",
        display: "block",
      });
    }
  }, []);

  // Trigger after image natural dimensions are available
  useEffect(() => {
    if (!isAutoMode) return;
    const img = imgRef.current;
    if (!img) return;

    // Double-rAF: ensures layout is fully settled before we measure
    const run = () =>
      requestAnimationFrame(() => requestAnimationFrame(computeAutoLayout));
    if (img.complete && img.naturalWidth) {
      run();
    } else {
      img.addEventListener("load", run);
      return () => img.removeEventListener("load", run);
    }
  }, [isAutoMode, computeAutoLayout]);

  // ResizeObserver: re-measure when the section OR the scroll container resizes
  // (covers window resize, fullscreen toggle, font-size changes, etc.)
  useEffect(() => {
    if (!isAutoMode || !wrapperRef.current) return;
    const section = wrapperRef.current.closest("section[data-id]");
    if (!section) return;

    // Also observe the scroll container so fullscreen toggles are caught even
    // when the section itself doesn't resize (e.g. content larger than container).
    let scrollEl: Element | null = section.parentElement;
    while (scrollEl && scrollEl !== document.documentElement) {
      const cs = window.getComputedStyle(scrollEl as HTMLElement);
      if (cs.overflowY === "auto" || cs.overflowY === "scroll") break;
      scrollEl = scrollEl.parentElement;
    }

    const ro = new ResizeObserver(() =>
      requestAnimationFrame(computeAutoLayout),
    );
    ro.observe(section);
    if (scrollEl && scrollEl !== document.documentElement) ro.observe(scrollEl);
    return () => ro.disconnect();
  }, [isAutoMode, computeAutoLayout]);

  // MutationObserver: re-measure when the slide transitions from hidden to visible
  // (SlideDeck sets `style.display` directly on the section element)
  useEffect(() => {
    if (!isAutoMode || !wrapperRef.current) return;
    const section = wrapperRef.current.closest("section[data-id]");
    if (!section) return;

    const mo = new MutationObserver(() =>
      requestAnimationFrame(() => requestAnimationFrame(computeAutoLayout)),
    );
    mo.observe(section, { attributes: true, attributeFilter: ["style"] });
    return () => mo.disconnect();
  }, [isAutoMode, computeAutoLayout]);

  if (!imageSrc) return null;

  const alignmentStyles = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  const captionTextAlign = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (isAutoMode) {
    return (
      <div
        id={label ? `fig-${label}` : undefined}
        ref={wrapperRef}
        className={`mt-2 mb-0 flex flex-col w-full ${className || ""}`}
        style={{ scrollMarginTop: "5rem" }}
      >
        <div className={`flex w-full ${alignmentStyles[align]}`}>
          <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            className="rounded-lg shadow-md block !my-0 max-w-full"
            style={autoStyle}
          />
        </div>
        {showFigcaption && (
          <figcaption
            className={`mt-4 w-full text-sm text-muted-foreground italic [&_.mdx-p]:inline [&_.mdx-p]:m-0 ${captionTextAlign[align]}`}
          >
            {hasFigNum && (
              <span className="font-semibold not-italic text-foreground/70">
                Fig. {figNum}
              </span>
            )}
            {hasFigNum && displayCaption && " \u2014 "}
            {displayCaption}
          </figcaption>
        )}
      </div>
    );
  }

  // Determine the active width based on the view mode
  const activeWidth =
    mode === "apresentacao" && widthPresentation !== undefined
      ? widthPresentation
      : width;

  // Normalize a width value to a valid CSS string.
  // Handles numbers (500 → "500px") and plain numeric strings ("500" → "500px").
  // Percentage and unit-bearing strings ("50%", "500px") are passed through.
  const normalizeToCss = (w: string | number): string => {
    if (typeof w === "number") return `${w}px`;
    if (/^\d+(\.\d+)?$/.test(w)) return `${w}px`;
    return w;
  };

  // In presentation mode, apply --slide-content-scale to pixel-based widths so
  // fixed images scale with the ± content-scale buttons.
  // Percentage/keyword values are left as-is (already relative to the container).
  const presentationStyleWidth = (() => {
    if (mode !== "apresentacao" || !activeWidth) return undefined;
    if (typeof activeWidth === "number") {
      return `calc(${activeWidth}px * var(--slide-content-scale, 1))`;
    }
    if (
      typeof activeWidth === "string" &&
      /^\d+(\.\d+)?px$/.test(activeWidth)
    ) {
      return `calc(${activeWidth} * var(--slide-content-scale, 1))`;
    }
    // Plain numeric string (e.g. "400") — treat as px for scale calculation
    if (typeof activeWidth === "string" && /^\d+(\.\d+)?$/.test(activeWidth)) {
      return `calc(${activeWidth}px * var(--slide-content-scale, 1))`;
    }
    return activeWidth;
  })();

  const imageWidthStyle =
    presentationStyleWidth ??
    (activeWidth ? normalizeToCss(activeWidth) : undefined);

  return (
    <div
      id={label ? `fig-${label}` : undefined}
      className={`my-8 flex flex-col w-full ${className || ""}`}
      style={{ scrollMarginTop: "5rem" }}
    >
      <div className={`flex w-full ${alignmentStyles[align]}`}>
        <img
          src={imageSrc}
          alt={alt}
          className="rounded-lg shadow-md h-auto transition-all duration-300 !my-0 max-w-full"
          style={{ width: imageWidthStyle ?? "auto", height: "auto" }}
        />
      </div>
      {showFigcaption && (
        <figcaption
          className={`mt-2 w-full text-sm text-muted-foreground italic [&_.mdx-p]:inline [&_.mdx-p]:m-0 ${captionTextAlign[align]}`}
        >
          {hasFigNum && (
            <span className="font-semibold not-italic text-foreground/70">
              Fig. {figNum}
            </span>
          )}
          {hasFigNum && displayCaption && " \u2014 "}
          {displayCaption}
        </figcaption>
      )}
    </div>
  );
}
