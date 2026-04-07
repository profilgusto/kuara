"use client";

/**
 * <CiteTessela> — Inline cross-reference component for MDX content.
 *
 * Usage:
 *   <CiteTessela slug="slam-concepts" />
 *   <CiteTessela slug="slam-concepts" label="SLAM" />
 *
 * Reads tessela data from TesselaLinksContext (provided by TesselaLinksProvider
 * in the tessela page). No client-side fetching.
 *
 * Clicking the inline link opens a popover card with the tessela's title,
 * abstract, stage badge, and a link to navigate to it.
 */

import { useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink, X, FileText } from "lucide-react";
import { useTesselaLinks } from "./TesselaLinksContext";

const stageLabel: Record<string, string> = {
  rascunho: "Rascunho",
  "em-andamento": "Em andamento",
  finalizado: "Finalizado",
  incrementando: "Incrementando",
};

const stageClass: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  "em-andamento":
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  finalizado:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  incrementando:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

interface CiteTesselaProps {
  /** Slug of the tessela to cite */
  slug: string;
  /** Optional display text (defaults to tessela title) */
  label?: string;
}

export default function CiteTessela({ slug, label }: CiteTesselaProps) {
  const [open, setOpen] = useState(false);
  const { bySlug } = useTesselaLinks();
  const tessela = bySlug.get(slug);

  if (!tessela) {
    return (
      <span className="text-muted-foreground text-sm italic not-prose">
        [{label ?? slug}]
      </span>
    );
  }

  const displayLabel = label ?? tessela.title;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="not-prose inline-flex items-center gap-1 text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 decoration-dotted cursor-pointer transition-colors"
          aria-label={`Ver tessela: ${tessela.title}`}
        >
          <FileText className="h-3 w-3 flex-shrink-0" />
          <span className="text-sm">{displayLabel}</span>
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
            "z-50 rounded-xl border border-border/40 shadow-lg",
            "bg-background/60 backdrop-blur-md",
            "p-4 max-w-sm w-[320px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=top]:slide-in-from-bottom-2",
            "data-[side=bottom]:slide-in-from-top-2",
          ].join(" ")}
          style={{ maxWidth: "90vw" }}
        >
          <div className="relative flex flex-col gap-3">
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-0 right-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Stage badge + title + abstract */}
            <div className="pr-6 flex flex-col gap-1.5">
              {tessela.stage && (
                <span
                  className={`self-start text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${stageClass[tessela.stage] ?? stageClass.rascunho}`}
                >
                  {stageLabel[tessela.stage] ?? tessela.stage}
                </span>
              )}
              <p className="text-sm font-semibold leading-snug text-foreground">
                {tessela.title}
              </p>
              {tessela.abstract && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {tessela.abstract}
                </p>
              )}
            </div>

            {/* Navigation link */}
            <Link
              href={`/tesselas/${tessela.slug}`}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium border-t border-border/30 pt-2"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir tessela
            </Link>
          </div>

          <Popover.Arrow className="fill-background/80" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
