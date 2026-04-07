"use client";

/**
 * <ReferencesSection> — Auto-generated bibliography section.
 *
 * Rendered by the module page below the MDX article whenever there are
 * citations in the content. Reads ordered reference data from
 * ReferencesContext — no props needed.
 *
 * Only shows references that are actually cited (citationOrder contains
 * only keys found in the MDX, in first-appearance order).
 */

import { useReferences, isNumericStyle } from "./ReferencesContext";
import { useViewMode } from "@/components/mdx/useViewMode";

export default function ReferencesSection() {
  const { byKey, citationOrder, style } = useReferences();
  const mode = useViewMode();

  // Only the references that are both cited and available in Payload
  const cited = citationOrder.filter((k) => byKey.has(k));
  if (cited.length === 0) return null;

  const numeric = isNumericStyle(style);
  const isPresentation = mode === "apresentacao";

  const referenceList = (
    <ol className="space-y-4 list-none m-0 p-0">
      {cited.map((key, idx) => {
        const ref = byKey.get(key)!;
        const doiUrl = ref.doi ? `https://doi.org/${ref.doi}` : undefined;
        const externalLink = doiUrl ?? ref.externalUrl;

        return (
          <li
            key={key}
            id={`ref-${key}`}
            className="flex gap-3 items-start group"
          >
            <span
              className={[
                "flex-shrink-0 min-w-[1.5rem] text-right text-xs leading-relaxed pt-0.5",
                numeric
                  ? "text-primary font-semibold"
                  : "text-muted-foreground/50 select-none",
              ].join(" ")}
              aria-hidden={!numeric}
            >
              {numeric ? `[${idx + 1}]` : `${idx + 1}.`}
            </span>

            <div className="flex flex-col gap-1 min-w-0">
              <div
                className="text-sm text-foreground/90 leading-relaxed [&_i]:italic [&_b]:font-semibold [&_.csl-bib-body]:block [&_.csl-entry]:block"
                dangerouslySetInnerHTML={{ __html: ref.bibliographyHtml }}
              />
              {externalLink && (
                <a
                  href={externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-secondary hover:text-secondary/80 transition-colors font-medium break-all"
                >
                  {ref.doi ? `https://doi.org/${ref.doi}` : externalLink}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );

  // Presentation mode: render as a proper slide so SlideDeck picks it up as the last slide
  if (isPresentation) {
    return (
      <section
        data-id="referencias"
        data-title="Referências"
        className="relative flex flex-col min-h-[400px] mx-auto mb-2 max-w-4xl px-6 pt-3 pb-12 rounded-2xl shadow-sm bg-[var(--bg)] text-[var(--fg)] w-full"
        style={{ fontSize: "calc(1rem * var(--slide-content-scale, 1))" }}
      >
        <div className="slide-layout-vertical space-y-4">
          <h1 className="text-[1.75em] font-semibold leading-[1.3] tracking-tight mb-[0.6em] text-foreground">
            Referências
          </h1>
          {referenceList}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Referências"
      className="mt-16 pt-8 border-t border-border/40"
    >
      <h1 className="text-[1.75em] font-semibold leading-[1.3] tracking-tight mb-[0.6em] text-foreground">
        Referências
      </h1>
      {referenceList}
    </section>
  );
}
