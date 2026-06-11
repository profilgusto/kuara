"use client";

import { ReactNode } from "react";
import { QuestionCounterProvider } from "@/components/mdx/QuestionCounterContext";
import ViewToggle from "@/components/mdx/ViewToggle";
import SlideDeck from "@/components/mdx/SlideDeck";
import PrintButton from "@/components/mdx/PrintButton";
import type { Heading } from "@/lib/mdx-pipeline";
import type { SlideCoverData } from "@/lib/slides";

interface ContentPageClientProps {
  children: ReactNode;
  title: string;
  headings: Heading[];
  slideCover?: SlideCoverData | null;
  printContextLabel?: string;
  questionOffsets?: Record<string, number>;
}

export function ContentPageClient({
  children,
  title,
  headings,
  slideCover,
  printContextLabel,
  questionOffsets,
}: ContentPageClientProps) {
  return (
    <>
      {/* ── Print-only: Cover page ──────────────────────────────────────── */}
      {/* break-inside-avoid intentionally omitted: when images are present the
          cover can exceed one A4 page, causing Chrome to emit a blank page 1
          before moving the element. Instead we size elements to fit within
          ~970px (A4 with 2cm margins) and rely solely on break-after-page. */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:text-center print:break-after-page print:py-12">
        {/* Platform badge */}
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-8">
          {printContextLabel ?? "Kuara"}
        </p>

        {/* Logo from SlideCover */}
        {slideCover?.logoImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slideCover.logoImage}
            alt="Logo"
            className="max-h-16 w-auto object-contain mb-6"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        {/* Background image from SlideCover as a visual accent */}
        {slideCover?.backgroundImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slideCover.backgroundImage}
            alt="Capa"
            className="max-h-36 max-w-xs object-cover mb-8 rounded-xl"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        {/* Context label (e.g. course name or "Kuara · Cadernos") */}
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
          {printContextLabel}
        </p>

        {/* Top separator */}
        <div className="w-12 h-[2px] bg-primary mb-5" />

        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight leading-tight mb-2 max-w-xl">
          {slideCover?.title || title}
        </h1>

        {/* Subtitle from SlideCover */}
        {slideCover?.subtitle && (
          <p className="text-lg text-muted-foreground mt-1 max-w-lg font-medium">
            {slideCover.subtitle}
          </p>
        )}

        {/* Bottom separator */}
        <div className="w-12 h-[2px] bg-border mt-6 mb-5" />

        {/* Metadata */}
        <div className="text-sm text-muted-foreground space-y-1">
          {slideCover?.author && (
            <p className="font-medium text-foreground">{slideCover.author}</p>
          )}
          {slideCover?.date && <p>{slideCover.date}</p>}
          <p suppressHydrationWarning>
            Gerado em{" "}
            {new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* ── Print-only: Table of contents ───────────────────────────────── */}
      {headings.length > 0 && (
        <div className="hidden print:block print:break-after-page">
          <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-border">
            Sumário
          </h2>
          <ul className="space-y-1">
            {headings.map((h) => (
              <li
                key={h.id}
                style={{ paddingLeft: `${(h.level - 1) * 1.25}rem` }}
                className={
                  h.level === 1
                    ? "mt-3 first:mt-0 font-semibold"
                    : h.level === 2
                      ? "mt-1 text-sm"
                      : "text-sm text-muted-foreground"
                }
              >
                <a
                  href={`#${h.id}`}
                  className="text-foreground no-underline hover:underline"
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Screen-only: title + action buttons ─────────────────────────── */}
      <div className="flex items-center justify-between mb-8 gap-4 print:hidden">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {title}
        </h1>
        <div className="flex items-center gap-1">
          <PrintButton />
          <ViewToggle />
        </div>
      </div>

      {/* ── Print-only: title above content (after TOC page) ─────── */}
      <h1 className="hidden print:block text-4xl font-bold tracking-tight mb-8 pb-4 border-b border-border">
        {title}
      </h1>

      {/* SlideDeck wrapper only affects rendering when mode='apresentacao' */}
      <QuestionCounterProvider initialCounts={questionOffsets}>
        <SlideDeck headings={headings}>{children}</SlideDeck>
      </QuestionCounterProvider>
    </>
  );
}
