"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { comBasePath } from "@/lib/base-path";
import {
  buildPeriod,
  sanitizeSemesterInput,
  sanitizeYearInput,
  suggestNextPeriod,
  type OfferOption,
} from "@/lib/offer-period";

const INPUT_CLASS =
  "rounded-md border border-border bg-input px-2 py-1.5 text-center font-mono text-lg text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

const BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-md border border-primary bg-transparent px-4 py-1.5 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const NONE = "";

/**
 * "Ofertas": creates the platform's general offers (2026.2, 2027.1…) and
 * picks the active one — the offer the course pages show, or none.
 *
 * Both go through Payload's REST API, which is also what checks the user is
 * an admin. `terms` arrives sorted, most recent first.
 */
export function TermsSettings({
  terms,
  activeTermId,
}: {
  terms: OfferOption[];
  activeTermId: string | number | null;
}) {
  const router = useRouter();
  const suggestion = suggestNextPeriod(terms.map((t) => t.period));
  const [year, setYear] = useState(suggestion.year);
  const [semester, setSemester] = useState(suggestion.semester);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    const result = buildPeriod(
      year,
      semester,
      terms.map((t) => t.period),
    );
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(comBasePath("/api/terms?depth=0"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ period: result.period }),
      });
      if (!res.ok) {
        setCreateError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite criar ofertas. Entre novamente como administrador."
            : "Não foi possível criar a oferta. Tente novamente.",
        );
        return;
      }
      const next = suggestNextPeriod([
        result.period,
        ...terms.map((t) => t.period),
      ]);
      setYear(next.year);
      setSemester(next.semester);
      router.refresh();
    } catch {
      setCreateError("Erro de conexão. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  async function setActive(value: string) {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(comBasePath("/api/globals/site-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          // The select hands back text; the relationship wants the id as is.
          activeTerm:
            terms.find((term) => String(term.id) === value)?.id ?? null,
        }),
      });
      if (!res.ok) {
        setSaveError("Não foi possível salvar. Tente novamente.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setSaveError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="terms-heading"
      className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div>
        <h2 id="terms-heading" className="text-lg font-semibold">
          Ofertas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada oferta criada aqui vale para todas as disciplinas. A oferta ativa
          é a que aparece nas páginas das disciplinas.
        </p>
      </div>

      <div>
        <label
          htmlFor="oferta-ativa"
          className="mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
        >
          Oferta ativa
        </label>
        <div className="flex items-center gap-2">
          <select
            id="oferta-ativa"
            value={activeTermId === null ? NONE : String(activeTermId)}
            onChange={(event) => void setActive(event.target.value)}
            disabled={saving}
            className="rounded-md border border-border bg-input px-2 py-1.5 font-mono text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
          >
            <option value={NONE}>Nenhuma</option>
            {terms.map((term) => (
              <option key={term.id} value={String(term.id)}>
                {term.period}
              </option>
            ))}
          </select>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saved && !saving && (
            <span role="status" className="text-xs text-muted-foreground">
              Salvo.
            </span>
          )}
        </div>
        {saveError && (
          <p
            role="alert"
            className="mt-2 rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
          >
            {saveError}
          </p>
        )}
      </div>

      <form onSubmit={create} noValidate className="space-y-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          Criar oferta
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Ano
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="2027"
              value={year}
              onChange={(e) => setYear(sanitizeYearInput(e.target.value))}
              disabled={creating}
              className={`${INPUT_CLASS} w-24`}
            />
          </label>
          <span
            aria-hidden
            className="pb-1.5 font-mono text-lg text-muted-foreground"
          >
            .
          </span>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Semestre
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="1"
              value={semester}
              onChange={(e) =>
                setSemester(sanitizeSemesterInput(e.target.value))
              }
              disabled={creating}
              className={`${INPUT_CLASS} w-14`}
            />
          </label>
          <button type="submit" disabled={creating} className={BUTTON_CLASS}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar
          </button>
        </div>
        {createError && (
          <p
            role="alert"
            className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
          >
            {createError}
          </p>
        )}
      </form>

      <div>
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          Ofertas criadas
        </p>
        {terms.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Nenhuma oferta criada.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {terms.map((term) => (
              <li
                key={term.id}
                className={`rounded-md border px-2 py-1 font-mono text-sm ${
                  String(term.id) === String(activeTermId)
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {term.period}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
