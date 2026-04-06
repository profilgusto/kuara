import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import Link from "next/link";
import { getTessela } from "@/lib/payload-content";
import { compileMdx, extractHeadings } from "@/lib/mdx-pipeline";
import { getMdxComponents } from "@/lib/mdx-components";
import { ContentPageClient } from "@/components/content/ContentPageClient";
import { TesselaLayout } from "@/components/tesselas/TesselaLayout";
import { ReferencesProvider } from "@/components/citations/ReferencesProvider";
import ReferencesSection from "@/components/citations/ReferencesSection";
import { extractCiteLabels, fetchAndFormatReferences } from "@/lib/citations";
import type { CitationStyle } from "@/lib/citation-shared";
import { extractFigureLabels } from "@/lib/figures";
import { FiguresProvider } from "@/components/figures/FiguresProvider";
import { extractSlideCoverProps } from "@/lib/slides";

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
    tessela.abstract ??
    `Tessela "${tessela.title}" na plataforma Kuara.`;

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

  // ── Compile MDX ───────────────────────────────────────────────────────────
  let content = null;
  if (tessela.content) {
    const compiled = await compileMdx(tessela.content, getMdxComponents());
    content = compiled.content;
  }

  const status = statusConfig[tessela.stage] ?? statusConfig["rascunho"];

  return (
    <TesselaLayout headings={headings} tesselaTitle={tessela.title}>
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
                  Esta tessela ainda não possui conteúdo.
                </p>
              </div>
            )}
          </ContentPageClient>
        </FiguresProvider>
      </ReferencesProvider>

      {/* ── Metadata section ──────────────────────────────────────────────── */}
      <div className="mt-12 pt-8 border-t border-border space-y-6 print:hidden">
        {/* Status + dates + project */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span
            className={`text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded-full ${status.className}`}
          >
            {status.label}
          </span>
          {tessela.project.map((p) => (
            <span key={p} className="text-[11px] uppercase tracking-wider font-medium">
              {p}
            </span>
          ))}
          {tessela.publishedAt && (
            <span>
              Publicado em{" "}
              {new Date(tessela.publishedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
          {tessela.updatedAt && (
            <span>
              · Atualizado em{" "}
              {new Date(tessela.updatedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Tags */}
        {tessela.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tessela.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Outgoing: tesselas referenciadas */}
        {tessela.relatedTesselas && tessela.relatedTesselas.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">
              Tesselas referenciadas
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {tessela.relatedTesselas.map((t) => (
                <Link
                  key={t.id}
                  href={`/tesselas/${t.slug}`}
                  className="block border rounded-lg p-4 hover:border-primary/40 transition-colors space-y-1"
                >
                  <p className="font-medium text-sm leading-snug">{t.title}</p>
                  {t.abstract && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {t.abstract}
                    </p>
                  )}
                  {t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {t.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Incoming: referenciada por */}
        {tessela.referencedBy && tessela.referencedBy.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">
              Referenciada por
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {tessela.referencedBy.map((t) => (
                <Link
                  key={t.id}
                  href={`/tesselas/${t.slug}`}
                  className="block border rounded-lg p-4 hover:border-primary/40 transition-colors space-y-1"
                >
                  <p className="font-medium text-sm leading-snug">{t.title}</p>
                  {t.abstract && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {t.abstract}
                    </p>
                  )}
                  {t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {t.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related disciplinas */}
        {tessela.relatedDisciplinas && tessela.relatedDisciplinas.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Disciplinas relacionadas</h2>
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

        {/* Related modules */}
        {tessela.relatedModules && tessela.relatedModules.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Módulos relacionados</h2>
            <div className="flex flex-wrap gap-2">
              {tessela.relatedModules.map((m) => (
                <Link
                  key={m.id}
                  href={`/disciplinas/${m.courseSlug}/${m.slug}`}
                  className="text-sm border rounded-lg px-3 py-1.5 hover:border-primary/40 transition-colors"
                >
                  {m.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </TesselaLayout>
  );
}
