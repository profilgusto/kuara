"use client";

/**
 * <RefFig label="fig-xyz" />
 *
 * Renders an inline "Fig. N" link that:
 *  - On hover: shows a thumbnail popover (image + caption preview)
 *  - On click: smooth-scrolls to the figure and flashes a highlight animation
 *
 * Requires <FiguresProvider> as an ancestor. Degrades gracefully if the
 * label is not found (renders "[Fig.?]").
 */

import { useContext, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Image as ImageIcon } from "lucide-react";
import { FiguresContext, type FigureMetadata } from "./FiguresContext";

interface RefFigProps {
  label: string;
}

export default function RefFig({ label }: RefFigProps) {
  const [open, setOpen] = useState(false);
  // Metadata is read lazily on hover (not at render time) because KImage
  // registers it in a useEffect into a useRef — no re-render is triggered.
  // By hover time, KImage has already mounted and the ref is populated.
  const [meta, setMeta] = useState<FigureMetadata | undefined>(undefined);
  const ctx = useContext(FiguresContext);

  // Graceful degradation: no provider or unknown label
  if (!ctx) {
    return <span className="text-muted-foreground">[Fig.?]</span>;
  }

  const idx = ctx.indexOfLabel(label);
  if (idx === -1) {
    return <span className="text-muted-foreground">[Fig.{label}?]</span>;
  }

  const figText = `Fig. ${idx}`;

  const handleClick = () => {
    const el = document.getElementById(`fig-${label}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("fig-highlight-active");
    void (el as HTMLElement).offsetWidth; // force reflow to restart animation
    el.classList.add("fig-highlight-active");
    el.addEventListener(
      "animationend",
      () => el.classList.remove("fig-highlight-active"),
      { once: true },
    );
  };

  const handleMouseEnter = () => {
    const m = ctx.getMetadata(label);
    if (m) {
      setMeta(m);
      setOpen(true);
    }
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
          aria-label={`Ir para ${figText}`}
        >
          {figText}
        </button>
      </Popover.Trigger>

      {meta && (
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
              "z-50 rounded-xl border border-border/40 shadow-lg",
              "bg-background/60 backdrop-blur-md",
              "p-3 w-[260px]",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=top]:slide-in-from-bottom-2",
              "data-[side=bottom]:slide-in-from-top-2",
            ].join(" ")}
            style={{ maxWidth: "90vw" }}
          >
            {/* Thumbnail */}
            <div className="rounded-lg overflow-hidden border border-border/30 mb-2 bg-accent/10 flex items-center justify-center">
              {meta?.src ? (
                <img
                  src={meta.src}
                  alt={meta.captionText || figText}
                  className="w-full h-auto max-h-44 object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-20 w-full">
                  <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Label + caption */}
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground not-italic">
                {figText}
              </span>
              {meta?.captionText && ` — ${meta.captionText}`}
            </p>

            <Popover.Arrow className="fill-background/80" />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}
