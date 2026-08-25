import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import Link from "next/link";
import {
  getTessela,
  fetchTesselaLinks,
  fetchModuleLinks,
} from "@/lib/payload-content";
import { compileMdx, extractHeadings } from "@/lib/mdx-pipeline";
import { getMdxComponents } from "@/lib/mdx-components";
import { ContentPageClient } from "@/components/content/ContentPageClient";
import { TesselaLayout } from "@/components/tesselas/TesselaLayout";
import { TesselaLinksProvider } from "@/components/tesselas/TesselaLinksContext";
import { ReferencesProvider } from "@/components/citations/ReferencesProvider";
import ReferencesSection from "@/components/citations/ReferencesSection";
import { extractCiteLabels, fetchAndFormatReferences } from "@/lib/citations";
import type { CitationStyle } from "@/lib/citation-shared";
import { extractFigureLabels } from "@/lib/figures";
import { FiguresProvider } from "@/components/figures/FiguresProvider";
import { extractSlideCoverProps } from "@/lib/slides";
import { extractCiteTesselaSlugs } from "@/lib/tessela-links";
import { ModuleLinksProvider } from "@/components/disciplinas/ModuleLinksContext";
import { extractCiteModuleSlugs } from "@/lib/module-links";
import CitedRelations from "@/components/CitedRelations";

import { HideInPresentation } from "@/components/mdx/HideInPresentation";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: {
    label: "Rascunho",
    className: "bg-muted text-muted-foreground",
  },
  "em-andamento": {
    label: "Em andamento",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  finalizado: {
    label: "Finalizado",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  incrementando: {
    label: "Incrementando",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tessela = await getTessela(slug, false);
  if (!tessela) return {};

  const title = `${tessela.title} | Tesselas · Kuara`;
  const description =
    tessela.abstract ?? `Tessela "${tessela.title}" na plataforma Kuara.`;

  return {
    title,
    description,
    openGraph: {
      title: tessela.title,
      description,
      type: "article",
    },
  };
}

export default async function TesselaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { isEnabled: isDraftMode } = await draftMode();

  const tessela = await getTessela(slug, isDraftMode);
  if (!tessela) notFound();

  const headings = tessela.content ? extractHeadings(tessela.content) : [];

  // ── Citations ──────────────────────────────────────────────────────────────
  const citationStyle: CitationStyle =
    (tessela.citationStyle as CitationStyle) ?? "authoryear";
  const citationOrder = tessela.content
    ? extractCiteLabels(tessela.content)
    : [];
  const references = await fetchAndFormatReferences(
    citationOrder,
    citationStyle,
    isDraftMode,
  );

  // ── Figures ────────────────────────────────────────────────────────────────
  const figureOrder = tessela.content
    ? extractFigureLabels(tessela.content)
    : [];

  // ── Slide cover ────────────────────────────────────────────────────────────
  const slideCover = tessela.content
    ? extractSlideCoverProps(tessela.content)
    : null;

  // ── CiteTessela cross-references ───────────────────────────────────────────
  const citeTesselaSlugs = tessela.content
    ? extractCiteTesselaSlugs(tessela.content)
    : [];
  const tesselaLinks = await fetchTesselaLinks(citeTesselaSlugs, isDraftMode);
  // ── CiteModule cross-references ────────────────────────────────────────────
  const citeModuleSlugs = tessela.content
    ? extractCiteModuleSlugs(tessela.content)
    : [];
  const moduleLinks = await fetchModuleLinks(citeModuleSlugs, isDraftMode);

  // ── Compile MDX ───────────────────────────────────────────────────────────
  let content = null;
  if (tessela.content) {
    const compiled = await compileMdx(tessela.content, getMdxComponents());
    content = compiled.content;
  }

  const status = statusConfig[tessela.stage] ?? statusConfig["rascunho"];

  return (
    <TesselaLayout headings={headings} tesselaTitle={tessela.title}>
      <ModuleLinksProvider modules={moduleLinks}>
        <TesselaLinksProvider tesselas={tesselaLinks}>
          <ReferencesProvider
            references={references}
            citationOrder={citationOrder}
            style={citationStyle}
          >
            <FiguresProvider figureOrder={figureOrder}>
              <ContentPageClient
                title={tessela.title}
                headings={headings}
                slideCover={slideCover}
                printContextLabel="Kuara · Tesselas"
              >
                {content ? (
                  <>
                    <article className="prose prose-neutral dark:prose-invert max-w-none">
                      {content}
                    </article>
                  </>
                ) : (
                  <div className="text-center py-12 border border-dashed rounded-xl">
                    <p className="text-muted-foreground">
                      Esta tessela ainda não possui conteúdo.
                    </p>
                  </div>
                )}
              </ContentPageClient>
            </FiguresProvider>

            {/* ── Metadata section ──────────────────────────────────────────────── */}
            <HideInPresentation>
              <div className="mt-12 pt-8 border-t border-border space-y-6 print:hidden">
                {/* Authors */}
                {tessela.authors.length > 0 && (
                  <p className="text-base text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {tessela.authors.length === 1 ? "Autor:" : "Autores:"}
                    </span>{" "}
                    {tessela.authors.join(" · ")}
                  </p>
                )}

                {(tessela.publishedAt || tessela.updatedAt) && (
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {tessela.publishedAt && (
                      <span>
                        Publicado em{" "}
                        {new Date(tessela.publishedAt).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          },
                        )}
                      </span>
                    )}
                    {tessela.updatedAt && (
                      <span>
                        · Atualizado em{" "}
                        {new Date(tessela.updatedAt).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          },
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Status + labels + Tags */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className={`text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded-full ${status.className}`}
                  >
                    {status.label}
                  </span>
                  {tessela.project.map((p) => (
                    <span
                      key={p}
                      className="text-[11px] uppercase tracking-wider font-medium"
                    >
                      {p}
                    </span>
                  ))}
                  {tessela.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] bg-muted text-muted-foreground px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <ReferencesSection />

                <CitedRelations
                  citedTesselas={tessela.relatedTesselas}
                  citedModules={tessela.relatedModules}
                  citedByTesselas={tessela.referencedBy}
                  citedByModules={tessela.referencedByModules}
                />

                {/* Related disciplinas */}
                {tessela.relatedDisciplinas &&
                  tessela.relatedDisciplinas.length > 0 && (
                    <div>
                      <h2 className="text-base font-semibold mb-3">
                        Disciplinas relacionadas
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {tessela.relatedDisciplinas.map((d) => (
                          <Link
                            key={d.id}
                            href={`/disciplinas/${d.slug}`}
                            className="text-sm border rounded-lg px-3 py-1.5 hover:border-primary/40 transition-colors"
                          >
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">
                              {d.code}
                            </span>
                            {d.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </HideInPresentation>
          </ReferencesProvider>
        </TesselaLinksProvider>
      </ModuleLinksProvider>
    </TesselaLayout>
  );
}
