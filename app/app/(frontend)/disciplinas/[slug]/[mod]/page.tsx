import { notFound } from "next/navigation";
import { getCourse, getModule } from "@/lib/payload-content";
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

import { draftMode } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string; mod: string }>;
}) {
  const { slug, mod } = await params;
  const { isEnabled: isDraftMode } = await draftMode();

  const [course, result] = await Promise.all([
    getCourse(slug, isDraftMode),
    getModule(slug, mod, isDraftMode),
  ]);

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
      <ReferencesProvider
        references={references}
        citationOrder={citationOrder}
        style={citationStyle}
      >
        <FiguresProvider figureOrder={figureOrder}>
          <ModulePageClient title={moduleData.title}>
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
        </FiguresProvider>
      </ReferencesProvider>
    </ModuleLayout>
  );
}
