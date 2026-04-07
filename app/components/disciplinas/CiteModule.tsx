"use client";

/**
 * <CiteModule> — Inline cross-reference component for MDX content.
 *
 * Usage:
 *   <CiteModule slug="mt01-introducao" />
 *   <CiteModule slug="mt01-introducao" label="Introdução" />
 *
 * Reads module data from ModuleLinksContext (provided by ModuleLinksProvider
 * in the page). No client-side fetching.
 *
 * Clicking the inline link opens a popover card with the module's title,
 * type badge, and a link to navigate to it.
 */

import { useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink, X, BookOpen } from "lucide-react";
import { useModuleLinks } from "./ModuleLinksContext";

const typeLabel: Record<string, string> = {
  "modulo-teorico": "Módulo Teórico",
  "modulo-pratico": "Módulo Prático",
  "atividade-avaliativa": "Atividade Avaliativa",
  recurso: "Recurso",
};

const typeClass: Record<string, string> = {
  "modulo-teorico":
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "modulo-pratico":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "atividade-avaliativa":
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  recurso: "bg-muted text-muted-foreground",
};

interface CiteModuleProps {
  /** Slug of the module to cite */
  slug: string;
  /** Optional display text (defaults to module title) */
  label?: string;
}

export default function CiteModule({ slug, label }: CiteModuleProps) {
  const [open, setOpen] = useState(false);
  const { bySlug } = useModuleLinks();
  const mod = bySlug.get(slug);

  if (!mod) {
    return (
      <span className="text-muted-foreground text-sm italic not-prose">
        [{label ?? slug}]
      </span>
    );
  }

  const displayLabel = label ?? mod.title;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="not-prose inline-flex items-center gap-1 text-secondary hover:text-secondary/80 underline underline-offset-2 decoration-secondary/40 decoration-dotted cursor-pointer transition-colors"
          aria-label={`Ver módulo: ${mod.title}`}
        >
          <BookOpen className="h-3 w-3 flex-shrink-0" />
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

            {/* Type badge + title */}
            <div className="pr-6 flex flex-col gap-1.5">
              {mod.type && (
                <span
                  className={`self-start text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${typeClass[mod.type] ?? typeClass.recurso}`}
                >
                  {typeLabel[mod.type] ?? mod.type}
                </span>
              )}
              <p className="text-sm font-semibold leading-snug text-foreground">
                {mod.title}
              </p>
            </div>

            {/* Navigation link */}
            {mod.courseSlug && (
              <Link
                href={`/disciplinas/${mod.courseSlug}/${mod.slug}`}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors font-medium border-t border-border/30 pt-2"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir módulo
              </Link>
            )}
          </div>

          <Popover.Arrow className="fill-background/80" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
