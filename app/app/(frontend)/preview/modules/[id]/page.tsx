import { notFound } from "next/navigation";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { compileMdx, extractHeadings } from "@/lib/mdx-pipeline";
import { getMdxComponents } from "@/lib/mdx-components";
import { ModulePageClient } from "@/components/mdx/ModulePageClient";
import { ReferencesProvider } from "@/components/citations/ReferencesProvider";
import { FiguresProvider } from "@/components/figures/FiguresProvider";
import { extractCiteLabels, fetchAndFormatReferences } from "@/lib/citations";
import { extractFigureLabels } from "@/lib/figures";
import type { CitationStyle } from "@/lib/citation-shared";
import { PreviewRefreshScript } from "./PreviewRefreshScript";
import { extractSlideCoverProps } from "@/lib/slides";

export const dynamic = "force-dynamic";

/**
 * Dedicated preview page for Payload Live Preview.
 * Fetches the module by ID with draft:true so unpublished
 * content is visible in the admin's side-by-side preview.
 */
export default async function ModulePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payload = await getPayload({ config: configPromise });

  // Always fetch as draft so the latest autosaved content is shown
  let moduleDoc: any;
  try {
    moduleDoc = await payload.findByID({
      collection: "modules",
      id,
      depth: 1,
      draft: true,
    });
  } catch {
    notFound();
  }

  if (!moduleDoc) notFound();

  // Safely access course — may be null on brand new modules
  const courseObj =
    moduleDoc.course && typeof moduleDoc.course === "object"
      ? moduleDoc.course
      : null;
  const courseTitle = courseObj?.title || "Disciplina";

  const isDraft = moduleDoc._status !== "published";
  const hasContent = Boolean(moduleDoc.content?.trim());

  // Extract headings from raw MDX
  const headings = hasContent ? extractHeadings(moduleDoc.content) : [];
  const slideCover = hasContent ? extractSlideCoverProps(moduleDoc.content) : null;

  // Citations and figures
  const citationStyle: CitationStyle = (moduleDoc.citationStyle as CitationStyle) ?? "authoryear";
  const citationOrder = hasContent ? extractCiteLabels(moduleDoc.content) : [];
  const figureOrder = hasContent ? extractFigureLabels(moduleDoc.content) : [];
  const references = await fetchAndFormatReferences(citationOrder, citationStyle, true);

  // Compile MDX content
  let content = null;
  if (hasContent) {
    try {
      const compiled = await compileMdx(moduleDoc.content, getMdxComponents());
      content = compiled.content;
    } catch (err) {
      console.error("Failed to compile MDX in preview:", err);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Script that auto-refreshes this iframe when Payload saves */}
      <PreviewRefreshScript />

      <main className="container max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <span>Disciplinas</span>
          <span>/</span>
          <span>{courseTitle}</span>
          <span>/</span>
          <span className="text-foreground font-medium truncate">
            {moduleDoc.title || "Novo Módulo"}
          </span>
        </nav>

        {/* Preview banner — only shown for unpublished drafts */}
        {isDraft && (
          <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            ⚡ Pré-visualização — este conteúdo ainda não foi publicado
          </div>
        )}

        {/* Module content */}
        <ReferencesProvider
          references={references}
          citationOrder={citationOrder}
          style={citationStyle}
        >
          <FiguresProvider figureOrder={figureOrder}>
            <ModulePageClient
              title={moduleDoc.title || "Novo Módulo"}
              headings={headings}
              courseTitle={courseTitle}
              slideCover={slideCover}
            >
              {content ? (
                <article className="prose prose-neutral dark:prose-invert max-w-none">
                  {content}
                </article>
              ) : (
                <div className="text-center py-12 border border-dashed rounded-xl">
                  <p className="text-muted-foreground">
                    {hasContent
                      ? "Erro ao compilar o conteúdo MDX."
                      : "Este módulo ainda não possui conteúdo. Escreva algo no campo Content e salve (Cmd+S)."}
                  </p>
                </div>
              )}
            </ModulePageClient>
          </FiguresProvider>
        </ReferencesProvider>
      </main>
    </div>
  );
}
