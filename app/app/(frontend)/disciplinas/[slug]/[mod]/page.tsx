import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse, getModule, fetchTesselaLinks, fetchModuleLinks } from "@/lib/payload-content";
import { compileMdx, extractHeadings } from "@/lib/mdx-pipeline";
import { getMdxComponents } from "@/lib/mdx-components";
import { ModulePageClient } from "@/components/mdx/ModulePageClient";
import { ModuleLayout } from "@/components/mdx/ModuleLayout";
import { ReferencesProvider } from "@/components/citations/ReferencesProvider";
import ReferencesSection from "@/components/citations/ReferencesSection";
import { extractCiteLabels, fetchAndFormatReferences } from "@/lib/citations";
import type { CitationStyle } from "@/lib/citation-shared";
import { extractFigureLabels } from "@/lib/figures";
import { FiguresProvider } from "@/components/figures/FiguresProvider";
import { extractSlideCoverProps } from "@/lib/slides";
import { TesselaLinksProvider } from "@/components/tesselas/TesselaLinksContext";
import { extractCiteTesselaSlugs } from "@/lib/tessela-links";
import { ModuleLinksProvider } from "@/components/disciplinas/ModuleLinksContext";
import { extractCiteModuleSlugs } from "@/lib/module-links";
import CitedRelations from "@/components/CitedRelations";
import { HideInPresentation } from "@/components/mdx/HideInPresentation";

import { draftMode } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; mod: string }>;
}): Promise<Metadata> {
  const { slug, mod } = await params;
  const result = await getModule(slug, mod, false);
  if (!result) return {};

  const { module: moduleData, courseTitle } = result;
  const title = `${moduleData.title} — ${courseTitle} | Kuara`;
  const description = `Módulo "${moduleData.title}" da disciplina ${courseTitle} na plataforma Kuara.`;

  return {
    title,
    description,
    openGraph: {
      title: `${moduleData.title} — ${courseTitle}`,
      description,
      type: "article",
    },
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string; mod: string }>;
}) {
  const { slug, mod } = await params;
  const { isEnabled: isDraftMode } = await draftMode();

  const [courseSettled, moduleSettled] = await Promise.allSettled([
    getCourse(slug, isDraftMode),
    getModule(slug, mod, isDraftMode),
  ]);

  if (
    courseSettled.status === "rejected" ||
    moduleSettled.status === "rejected"
  ) {
    throw new Error("Failed to load module content");
  }

  const course = courseSettled.value;
  const result = moduleSettled.value;

  if (!course || !result) notFound();

  const { module: moduleData, courseTitle, courseSlug } = result;

  const headings = moduleData.content
    ? extractHeadings(moduleData.content)
    : [];

  // ── Citations ──────────────────────────────────────────────────────────
  const citationStyle: CitationStyle = moduleData.citationStyle ?? "authoryear";
  const citationOrder = moduleData.content
    ? extractCiteLabels(moduleData.content)
    : [];
  const references = await fetchAndFormatReferences(
    citationOrder,
    citationStyle,
    isDraftMode,
  );
  // ── Figures ────────────────────────────────────────────────────────────
  const figureOrder = moduleData.content
    ? extractFigureLabels(moduleData.content)
    : [];
  // ── Slide cover ────────────────────────────────────────────────────────
  const slideCover = moduleData.content
    ? extractSlideCoverProps(moduleData.content)
    : null;
  // ── CiteTessela cross-references ───────────────────────────────────────
  const citeTesselaSlugs = moduleData.content
    ? extractCiteTesselaSlugs(moduleData.content)
    : [];
  const tesselaLinks = await fetchTesselaLinks(citeTesselaSlugs, isDraftMode);
  // ── CiteModule cross-references ────────────────────────────────────────
  const citeModuleSlugs = moduleData.content
    ? extractCiteModuleSlugs(moduleData.content)
    : [];
  const moduleLinks = await fetchModuleLinks(citeModuleSlugs, isDraftMode);
  // ──────────────────────────────────────────────────────────────────────

  let content = null;
  if (moduleData.content) {
    const compiled = await compileMdx(moduleData.content, getMdxComponents());
    content = compiled.content;
  }

  return (
    <ModuleLayout
      course={course}
      currentModuleSlug={moduleData.slug}
      headings={headings}
      courseTitle={courseTitle}
      courseSlug={courseSlug}
      moduleTitle={moduleData.title}
    >
      <ModuleLinksProvider modules={moduleLinks}>
      <TesselaLinksProvider tesselas={tesselaLinks}>
      <ReferencesProvider
        references={references}
        citationOrder={citationOrder}
        style={citationStyle}
      >
        <FiguresProvider figureOrder={figureOrder}>
          <ModulePageClient
            title={moduleData.title}
            headings={headings}
            courseTitle={courseTitle}
            slideCover={slideCover}
          >
            {content ? (
              <>
                <article className="prose prose-neutral dark:prose-invert max-w-none">
                  {content}
                </article>
                {citationOrder.length > 0 && <ReferencesSection />}
              </>
            ) : (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <p className="text-muted-foreground">
                  Este módulo ainda não possui conteúdo.
                </p>
              </div>
            )}
          </ModulePageClient>

          {/* ── Module metadata footer ───────────────────────────────────── */}
          <HideInPresentation>
            <div className="mt-12 pt-8 border-t border-border space-y-6 print:hidden">
              {/* Authors */}
              {moduleData.authors && moduleData.authors.length > 0 && (
                <p className="text-base text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {moduleData.authors.length === 1 ? "Autor:" : "Autores:"}
                  </span>{" "}
                  {moduleData.authors.join(" · ")}
                </p>
              )}

              {/* Dates */}
              {(moduleData.publishedAt || moduleData.updatedAt) && (
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {moduleData.publishedAt && (
                    <span>
                      Publicado em{" "}
                      {new Date(moduleData.publishedAt).toLocaleDateString(
                        "pt-BR",
                        { day: "2-digit", month: "long", year: "numeric" },
                      )}
                    </span>
                  )}
                  {moduleData.updatedAt && (
                    <span>
                      · Atualizado em{" "}
                      {new Date(moduleData.updatedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              )}

              <CitedRelations
                citedTesselas={moduleData.relatedTesselas}
                citedModules={moduleData.relatedModules}
                citedByTesselas={moduleData.referencedByTesselas}
                citedByModules={moduleData.referencedByModules}
              />
            </div>
          </HideInPresentation>
        </FiguresProvider>
      </ReferencesProvider>
      </TesselaLinksProvider>
      </ModuleLinksProvider>
    </ModuleLayout>
  );
}
