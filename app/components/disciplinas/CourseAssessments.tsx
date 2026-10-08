"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useSession } from "@/components/layout/SessionContext";
import { comBasePath } from "@/lib/base-path";
import { pickActiveOffer } from "@/lib/offer-period";
import {
  assessmentFromActivity,
  formatDueDate,
  formatPoints,
  sumAssessments,
  type AssessmentRow,
} from "@/lib/assessment";

type Loaded = { period: string | null; rows: AssessmentRow[] };

/**
 * "Avaliações": a collapsible block on the course page, under the summary,
 * with the assessments of the course's most recent offer — code, name,
 * points, due date and comment.
 *
 * Read from Payload's REST API, on first expansion and as the signed-in user,
 * because `activities` are not public: the course page is static and the data
 * must not travel in its HTML. Signed-out visitors do not see the block.
 */
export function CourseAssessments({ courseId }: { courseId: string | number }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (!session) return null;

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const offersRes = await fetch(
        comBasePath(
          `/api/offers?where[course][equals]=${courseId}&depth=0&limit=200&select[period]=true`,
        ),
        { credentials: "include" },
      );
      if (!offersRes.ok) throw new Error("offers");
      const offers: { id: string | number; period: string }[] = (
        await offersRes.json()
      ).docs;
      const offer = pickActiveOffer(offers);
      if (!offer) {
        setLoaded({ period: null, rows: [] });
        return;
      }
      const res = await fetch(
        comBasePath(
          `/api/activities?where[offer][equals]=${offer.id}&sort=order&depth=0&pagination=false`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("activities");
      const docs = (await res.json()).docs;
      setLoaded({
        period: offer.period,
        rows: docs.map(assessmentFromActivity),
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) void load();
  }

  const totals = sumAssessments(loaded?.rows ?? []);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="course-assessments"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
        Avaliações
        {loaded?.period && (
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {loaded.period}
          </span>
        )}
      </button>

      {open && (
        <div id="course-assessments" className="border-t">
          {loading && (
            <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="m-3 rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
            >
              Não foi possível carregar as avaliações.{" "}
              <button type="button" onClick={load} className="underline">
                Tentar novamente
              </button>
            </p>
          )}
          {loaded && loaded.rows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {loaded.period
                ? `Nenhuma avaliação cadastrada na oferta ${loaded.period}.`
                : "Esta disciplina ainda não tem oferta cadastrada."}
            </p>
          )}
          {loaded && loaded.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="w-28 px-4 py-3 font-semibold">
                      Código
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Nome
                    </th>
                    <th
                      scope="col"
                      className="w-24 px-4 py-3 text-right font-semibold"
                    >
                      Pontos
                    </th>
                    <th scope="col" className="w-32 px-4 py-3 font-semibold">
                      Data
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Comentário
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loaded.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">
                        {row.code}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{row.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {formatPoints(row.weight)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {formatDueDate(row.dueDate) || "—"}
                      </td>
                      <td className="max-w-64 whitespace-pre-line px-4 py-2.5 text-xs text-muted-foreground">
                        {row.comment}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border/60 bg-muted/30">
                  <tr>
                    <td colSpan={5} className="px-4 py-2.5">
                      <p className="text-sm">
                        <span className="text-muted-foreground">
                          Pontuação total do período:
                        </span>{" "}
                        <span
                          data-total="regular"
                          className="font-mono font-semibold tabular-nums"
                        >
                          {formatPoints(totals.regular)}
                        </span>{" "}
                        pts +{" "}
                        <span
                          data-total="extra"
                          className="font-mono tabular-nums"
                        >
                          {formatPoints(totals.extra)}
                        </span>{" "}
                        pt extra ={" "}
                        <span
                          data-total="total"
                          className="font-mono font-semibold tabular-nums"
                        >
                          {formatPoints(totals.total)}
                        </span>{" "}
                        pontos totais distribuídos
                      </p>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
