import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import Link from "next/link";
import { getCaderno } from "@/lib/payload-content";
import { compileMdx, extractHeadings } from "@/lib/mdx-pipeline";
import { getMdxComponents } from "@/lib/mdx-components";
import { ContentPageClient } from "@/components/content/ContentPageClient";
import { CadernoLayout } from "@/components/cadernos/CadernoLayout";
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
  const caderno = await getCaderno(slug, false);
  if (!caderno) return {};

  const title = `${caderno.title} | Cadernos · Kuara`;
  const description =
    caderno.abstract ??
    `Caderno "${caderno.title}" na plataforma Kuara.`;

  return {
    title,
    description,
    openGraph: {
      title: caderno.title,
      description,
      type: "article",
    },
  };
}

export default async function CadernoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { isEnabled: isDraftMode } = await draftMode();

  const caderno = await getCaderno(slug, isDraftMode);
  if (!caderno) notFound();

  const headings = caderno.content ? extractHeadings(caderno.content) : [];

  // ── Citations ──────────────────────────────────────────────────────────────
  const citationStyle: CitationStyle =
    (caderno.citationStyle as CitationStyle) ?? "authoryear";
  const citationOrder = caderno.content
    ? extractCiteLabels(caderno.content)
    : [];
  const references = await fetchAndFormatReferences(
    citationOrder,
    citationStyle,
    isDraftMode,
  );

  // ── Figures ────────────────────────────────────────────────────────────────
  const figureOrder = caderno.content
    ? extractFigureLabels(caderno.content)
    : [];

  // ── Slide cover ────────────────────────────────────────────────────────────
  const slideCover = caderno.content
    ? extractSlideCoverProps(caderno.content)
    : null;

  // ── Compile MDX ───────────────────────────────────────────────────────────
  let content = null;
  if (caderno.content) {
    const compiled = await compileMdx(caderno.content, getMdxComponents());
    content = compiled.content;
  }

  const status = statusConfig[caderno.stage] ?? statusConfig["rascunho"];

  return (
    <CadernoLayout headings={headings} cadernoTitle={caderno.title}>
      <ReferencesProvider
        references={references}
        citationOrder={citationOrder}
        style={citationStyle}
      >
        <FiguresProvider figureOrder={figureOrder}>
          <ContentPageClient
            title={caderno.title}
            headings={headings}
            slideCover={slideCover}
            printContextLabel="Kuara · Cadernos"
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
                  Este caderno ainda não possui conteúdo.
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
          {caderno.project && (
            <span className="text-[11px] uppercase tracking-wider font-medium">
              {caderno.project}
            </span>
          )}
          {caderno.publishedAt && (
            <span>
              Publicado em{" "}
              {new Date(caderno.publishedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
          {caderno.updatedAt && (
            <span>
              · Atualizado em{" "}
              {new Date(caderno.updatedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Tags */}
        {caderno.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {caderno.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Outgoing: cadernos referenciados */}
        {caderno.relatedCadernos && caderno.relatedCadernos.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">
              Cadernos referenciados
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {caderno.relatedCadernos.map((c) => (
                <Link
                  key={c.id}
                  href={`/cadernos/${c.slug}`}
                  className="block border rounded-lg p-4 hover:border-primary/40 transition-colors space-y-1"
                >
                  <p className="font-medium text-sm leading-snug">{c.title}</p>
                  {c.abstract && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {c.abstract}
                    </p>
                  )}
                  {c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.tags.slice(0, 3).map((tag) => (
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

        {/* Incoming: referenciado por */}
        {caderno.referencedBy && caderno.referencedBy.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">
              Referenciado por
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {caderno.referencedBy.map((c) => (
                <Link
                  key={c.id}
                  href={`/cadernos/${c.slug}`}
                  className="block border rounded-lg p-4 hover:border-primary/40 transition-colors space-y-1"
                >
                  <p className="font-medium text-sm leading-snug">{c.title}</p>
                  {c.abstract && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {c.abstract}
                    </p>
                  )}
                  {c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.tags.slice(0, 3).map((tag) => (
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
        {caderno.relatedDisciplinas && caderno.relatedDisciplinas.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Disciplinas relacionadas</h2>
            <div className="flex flex-wrap gap-2">
              {caderno.relatedDisciplinas.map((d) => (
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
        {caderno.relatedModules && caderno.relatedModules.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Módulos relacionados</h2>
            <div className="flex flex-wrap gap-2">
              {caderno.relatedModules.map((m) => (
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
    </CadernoLayout>
  );
}
