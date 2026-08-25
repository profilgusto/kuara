"use client";
/**
 * components/interactive/InteractiveBox.tsx
 *
 * The frame every Kuara interactive block renders inside — the MDX component
 * behind `<Interactive widget="…">` and its `:::interactive` alias.
 *
 * It owns everything that is true of ALL interactive blocks, so that a widget
 * only has to draw itself:
 *   - resolving the id against the registry, and failing legibly when it misses;
 *   - coercing authored attributes (always strings from a directive) via the
 *     widget's declared schema, and surfacing what it had to reject;
 *   - the box chrome, sizing, and the smaller cap that presentation mode needs;
 *   - a print fallback, since a WebGL canvas prints as a blank rectangle:
 *     an author-supplied poster, else the widget's own vector drawing, else
 *     the title and caption alone;
 *   - an error boundary, so one broken widget cannot take out the lesson.
 *
 * Interactive blocks are deliberately NOT part of the figure-numbering system
 * (`RefFig`): they are standalone blocks, and their caption carries no
 * "Figura N" prefix.
 */
import React, { useState } from "react";
import { MousePointerClick, AlertTriangle, Boxes } from "lucide-react";
import { useViewMode } from "@/components/mdx/useViewMode";
import { resolveMediaUrl } from "@/lib/base-path";
import { getWidget, implementedIds } from "./registry";
import type { WidgetMeta, WidgetVariant } from "./catalog";
import { num, parseProps } from "./props";
import { stageHeight } from "./stage";
import WidgetErrorBoundary from "./WidgetErrorBoundary";

export interface InteractiveProps {
  /** Catalogue id, e.g. "coord-frame-3d". */
  widget?: string;
  /** Overrides the catalogue title shown in the header. */
  title?: string;
  /** Box height in px. Falls back to the widget's `defaultHeight`. */
  height?: string | number;
  /** Static image to print in place of the live widget. */
  poster?: string;
  /** The block body: a caption, and the text that stands in when printing. */
  children?: React.ReactNode;
  /** Everything else is the widget's own parameters. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const MIN_HEIGHT = 160;
const MAX_HEIGHT = 900;

export default function Interactive({
  widget,
  title,
  height,
  poster,
  children,
  ...rest
}: InteractiveProps) {
  const mode = useViewMode();
  const entry = getWidget(widget);

  // Declared before the unknown-widget bail-out: a hook may not sit behind a
  // conditional return. The lazy initialiser tolerates `entry` being null.
  const [variant, setVariant] = useState(() => initialVariant(entry?.meta));

  if (!entry) {
    return <UnknownWidget id={widget} />;
  }

  const { meta, Component, PrintFallback } = entry;

  // Destructuring above already removed every box-level key, so `rest` is
  // exactly the widget's own parameter bag — anything left in it that the
  // schema does not declare is a genuine author typo, and gets reported.
  const { props, warnings } = parseProps(meta.props, rest);

  const heightSpec = num(meta.defaultHeight ?? 420, "", {
    min: MIN_HEIGHT,
    max: MAX_HEIGHT,
    integer: true,
  });
  const { value: boxHeight, warning: heightWarning } = heightSpec.parse(height);
  const allWarnings = heightWarning
    ? [...warnings, `height: ${heightWarning}`]
    : warnings;

  const stage = stageHeight(mode, boxHeight);

  const variants = meta.variants ?? [];
  const active = variants.find((v) => v.id === variant);

  // The switcher renames the block as it switches — a header still reading
  // "3D" over a plane would be worse than no buttons at all — but an author's
  // explicit `title` outranks both it and the catalogue.
  const heading = title || active?.title || meta.title;

  // Widgets that declare no variants never see the prop, so their signature
  // stays as narrow as it was before the switcher existed.
  const variantProp = variants.length > 0 ? { variant } : {};
  const posterUrl = poster ? resolveMediaUrl(poster) : meta.poster;

  return (
    <div className="my-8 mx-auto w-full max-w-4xl">
      {/* ── Screen ─────────────────────────────────────────────────────── */}
      <figure className="print:hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <Boxes className="h-4 w-4 flex-shrink-0 text-primary" />
          <span className="text-sm font-medium">{heading}</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            interativo
          </span>
          {variants.length > 0 && (
            <VariantSwitch
              variants={variants}
              active={variant}
              onSelect={setVariant}
            />
          )}
        </div>

        {allWarnings.length > 0 && <WarningStrip warnings={allWarnings} />}

        <div
          data-interactive-stage=""
          style={{ height: stage }}
          className="w-full"
        >
          <WidgetErrorBoundary title={meta.id}>
            <Component {...props} {...variantProp} />
          </WidgetErrorBoundary>
        </div>

        {children && (
          <figcaption className="border-t border-border px-3 py-2 text-sm text-muted-foreground [&>.mdx-p]:my-0">
            {children}
          </figcaption>
        )}
      </figure>

      {/* ── Print ──────────────────────────────────────────────────────── */}
      <div className="hidden print:block rounded-lg border border-border p-3">
        {/*
          Three tiers, most specific first: an author-supplied poster wins,
          then the widget's own vector drawing, and failing both the block
          still prints its title and caption so the page is never silent about
          what the reader is missing.
        */}
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={heading}
            className="mx-auto max-w-full rounded"
          />
        ) : PrintFallback ? (
          <PrintFallback {...props} {...variantProp} />
        ) : null}
        <p className="mt-2 text-sm font-medium">◫ Interativo: {heading}</p>
        {children && <div className="text-sm">{children}</div>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          Disponível interativamente na versão web.
        </p>
      </div>
    </div>
  );
}

/** The variant a block opens on: the declared default, else the first button. */
function initialVariant(meta: WidgetMeta | undefined): string | undefined {
  if (!meta?.variants?.length) return undefined;
  const declared = meta.variants.find((v) => v.id === meta.defaultVariant);
  return (declared ?? meta.variants[0]).id;
}

/**
 * The header's segmented button group.
 *
 * `radiogroup` rather than a row of buttons: the choices are mutually
 * exclusive views of one thing, which is what a screen reader should hear,
 * and it costs nothing to say so.
 */
function VariantSwitch({
  variants,
  active,
  onSelect,
}: {
  variants: WidgetVariant[];
  active: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Dimensão da visualização"
      className="flex items-center overflow-hidden rounded-md border border-border"
    >
      {variants.map((v) => {
        const selected = v.id === active;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={v.hint}
            onClick={() => onSelect(v.id)}
            className={[
              "px-2 py-0.5 text-xs font-medium transition-colors",
              // Hairlines between the buttons, not around each one, so the
              // group reads as one control.
              "border-l border-border first:border-l-0",
              selected
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shown when `widget` names something the registry does not have.
 *
 * A bare unknown JSX tag in MDX throws during compilation and blanks the whole
 * module; routing every widget through one known component turns that class of
 * typo into a contained, self-explaining box.
 */
function UnknownWidget({ id }: { id?: string }) {
  const available = implementedIds();
  return (
    <div className="my-8 mx-auto w-full max-w-4xl rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        {id
          ? `Interativo desconhecido: "${id}"`
          : "Interativo sem o parâmetro obrigatório `widget`."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Disponíveis: {available.length ? available.join(", ") : "nenhum"}.
      </p>
    </div>
  );
}

function WarningStrip({ warnings }: { warnings: string[] }) {
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        Parâmetros ignorados
      </p>
      <ul className="mt-0.5 list-disc pl-6 text-xs text-amber-900/80 dark:text-amber-200/80">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
