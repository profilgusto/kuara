import { notFound } from "next/navigation";
import { getTessela, fetchTesselaLinks } from "@/lib/payload-content";
import { compileMdx, extractHeadings } from "@/lib/mdx-pipeline";
import { getMdxComponents } from "@/lib/mdx-components";
import { ContentPageClient } from "@/components/content/ContentPageClient";
import { TesselaLayout } from "@/components/tesselas/TesselaLayout";
import { TesselaLinksProvider } from "@/components/tesselas/TesselaLinksContext";
import { ReferencesProvider } from "@/components/citations/ReferencesProvider";
import ReferencesSection from "@/components/citations/ReferencesSection";
import { FiguresProvider } from "@/components/figures/FiguresProvider";
import { extractCiteLabels, fetchAndFormatReferences } from "@/lib/citations";
import { extractFigureLabels } from "@/lib/figures";
import type { CitationStyle } from "@/lib/citation-shared";
import { extractSlideCoverProps } from "@/lib/slides";
import { extractCiteTesselaSlugs } from "@/lib/tessela-links";
import { PreviewRefreshScript } from "@/components/preview/PreviewRefreshScript";

export const dynamic = "force-dynamic";

/**
 * Dedicated preview page for Payload Live Preview (Tesselas).
 * Fetches the tessela by slug with draft:true so unpublished
 * content is visible in the admin's side-by-side preview.
 */
export default async function TesselaPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Always fetch as draft so the latest autosaved content is shown
  const tessela = await getTessela(slug, true);
  if (!tessela) notFound();

  const hasContent = Boolean(tessela.content?.trim());

  const headings = hasContent ? extractHeadings(tessela.content!) : [];
  const slideCover = hasContent
    ? extractSlideCoverProps(tessela.content!)
    : null;

  // Citations
  const citationStyle: CitationStyle =
    (tessela.citationStyle as CitationStyle) ?? "authoryear";
  const citationOrder = hasContent ? extractCiteLabels(tessela.content!) : [];
  const references = await fetchAndFormatReferences(
    citationOrder,
    citationStyle,
    true,
  );

  // Figures
  const figureOrder = hasContent ? extractFigureLabels(tessela.content!) : [];

  // CiteTessela cross-references
  const citeTesselaSlugs = hasContent
    ? extractCiteTesselaSlugs(tessela.content!)
    : [];
  const tesselaLinks = await fetchTesselaLinks(citeTesselaSlugs, true);

  // Compile MDX
  let content = null;
  if (hasContent) {
    try {
      const compiled = await compileMdx(tessela.content!, getMdxComponents());
      content = compiled.content;
    } catch (err) {
      console.error("Failed to compile MDX in tessela preview:", err);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Script that auto-refreshes this iframe when Payload saves */}
      <PreviewRefreshScript />

      <main className="container max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <span>Tesselas</span>
          <span>/</span>
          <span className="text-foreground font-medium truncate">
            {tessela.title}
          </span>
        </nav>

        {/* Preview banner */}
        <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          ⚡ Pré-visualização — este conteúdo ainda não foi publicado
        </div>

        <TesselaLayout headings={headings} tesselaTitle={tessela.title}>
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
                      {citationOrder.length > 0 && <ReferencesSection />}
                    </>
                  ) : (
                    <div className="text-center py-12 border border-dashed rounded-xl">
                      <p className="text-muted-foreground">
                        {hasContent
                          ? "Erro ao compilar o conteúdo MDX."
                          : "Esta tessela ainda não possui conteúdo. Escreva algo no campo Content e salve (Cmd+S)."}
                      </p>
                    </div>
                  )}
                </ContentPageClient>
              </FiguresProvider>
            </ReferencesProvider>
          </TesselaLinksProvider>
        </TesselaLayout>
      </main>
    </div>
  );
}
