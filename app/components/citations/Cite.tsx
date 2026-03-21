"use client";

/**
 * <Cite> — Inline citation component for MDX content.
 *
 * Usage (single reference):
 *   <Cite label="corke2011robotics" />
 *
 * Usage (multiple references in one bracket):
 *   <Cite labels={["corke2011robotics", "siciliano2010robotics"]} />
 *
 * The component reads citation data from ReferencesContext (provided by
 * ReferencesProvider in the module page) — no client-side fetching.
 *
 * Clicking the inline citation opens a card popup with:
 *  - Full formatted bibliography entry
 *  - Cover art (if available)
 *  - DOI / external URL links
 */

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink, X, BookOpen } from "lucide-react";
import Image from "next/image";
import { useReferences, isNumericStyle } from "./ReferencesContext";
import type { ReferenceData } from "./ReferencesContext";

// ─── Popup card for a single reference ───────────────────────────────────────

function CitationCard({
  ref: reference,
  onClose,
}: {
  ref: ReferenceData;
  onClose: () => void;
}) {
  const doiUrl = reference.doi ? `https://doi.org/${reference.doi}` : undefined;
  const externalLink = doiUrl ?? reference.externalUrl;

  return (
    <div className="relative flex flex-col gap-3 max-w-sm w-[340px]">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-0 right-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        aria-label="Fechar citação"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Header row: cover art + title/authors */}
      <div className="flex gap-3 pr-6">
        {reference.coverArtUrl ? (
          <div className="flex-shrink-0 w-14 h-20 rounded overflow-hidden border border-border/40 shadow-sm">
            <Image
              src={reference.coverArtUrl}
              alt={`Capa: ${reference.title}`}
              width={56}
              height={80}
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-14 h-20 rounded border border-border/40 bg-accent/20 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-semibold leading-snug line-clamp-3 text-foreground">
            {reference.title}
          </p>
          {reference.authorsDisplay && (
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
              {reference.authorsDisplay}
            </p>
          )}
          {reference.year && (
            <p className="text-xs text-primary font-medium">{reference.year}</p>
          )}
        </div>
      </div>

      {/* Full bibliography HTML */}
      <div
        className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-2 [&_i]:italic [&_b]:font-semibold"
        dangerouslySetInnerHTML={{ __html: reference.bibliographyHtml }}
      />

      {/* Links */}
      {externalLink && (
        <a
          href={externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors font-medium border-t border-border/30 pt-2"
        >
          <ExternalLink className="h-3 w-3" />
          {reference.doi ? `doi:${reference.doi}` : "Abrir referência"}
        </a>
      )}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CiteProps {
  /** Single cite key */
  label?: string;
  /** Multiple cite keys for a combined citation "[1,2]" or "(A, 2011; B, 2012)" */
  labels?: string[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Cite({ label, labels }: CiteProps) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { byKey, style, indexOfKey } = useReferences();

  const keys = labels ?? (label ? [label] : []);
  if (keys.length === 0) return null;

  // Filter to only keys that exist in the context
  const foundKeys = keys.filter((k) => byKey.has(k));
  if (foundKeys.length === 0) {
    // Graceful degradation: show the key as plain text
    return (
      <span className="text-muted-foreground text-xs align-super">
        [{keys.join(", ")}?]
      </span>
    );
  }

  const numeric = isNumericStyle(style);

  // Build the inline citation text
  const inlineText = numeric
    ? `[${foundKeys.map((k) => indexOfKey(k)).join(", ")}]`
    : foundKeys
        .map((k) => {
          const ref = byKey.get(k)!;
          // Strip outer parens from individual items then join with semicolon
          return ref.inlineAuthoryear.replace(/^\(|\)$/g, "");
        })
        .join("; ");
  const inlineDisplay = numeric ? inlineText : `(${inlineText})`;

  // Which key to show in the popup
  const popupKey = activeKey ?? foundKeys[0];
  const popupRef = byKey.get(popupKey)!;

  const handleInlineClick = (key?: string) => {
    setActiveKey(key ?? foundKeys[0]);
    setOpen(true);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {/* Render each key separately (so user can click individual items in a multi-cite) */}
        <button
          type="button"
          className="inline-flex items-baseline gap-0 cursor-pointer"
          onClick={() => handleInlineClick()}
          aria-label={`Ver referência: ${keys.join(", ")}`}
        >
          {numeric ? (
            <span className="text-muted-foreground text-xs font-medium align-super hover:text-foreground underline-offset-2 transition-colors">
              {inlineDisplay}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm hover:text-foreground underline-offset-2 transition-colors cursor-pointer">
              {inlineDisplay}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={8}
          avoidCollisions
          collisionPadding={16}
          className={[
            // Biofloresta glass-card — matches navbar/sidebar blur style
            "z-50 rounded-xl border border-border/40 shadow-lg",
            "bg-background/60 backdrop-blur-md",
            "p-4",
            // Enter animation
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=top]:slide-in-from-bottom-2",
            "data-[side=bottom]:slide-in-from-top-2",
          ].join(" ")}
          style={{ maxWidth: "90vw" }}
        >
          {/* Multi-cite key selector */}
          {foundKeys.length > 1 && (
            <div className="flex gap-1 mb-3 border-b border-border/30 pb-2">
              {foundKeys.map((k) => {
                const ref = byKey.get(k)!;
                const label = numeric
                  ? `[${indexOfKey(k)}]`
                  : `${ref.authorsDisplay.split(";")[0].split(",")[0]}, ${ref.year}`;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setActiveKey(k)}
                    className={[
                      "text-xs px-2 py-0.5 rounded-md border transition-colors",
                      popupKey === k
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <CitationCard ref={popupRef} onClose={() => setOpen(false)} />
          <Popover.Arrow className="fill-background/80" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
