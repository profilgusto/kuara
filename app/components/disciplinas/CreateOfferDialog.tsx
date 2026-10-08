"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { comBasePath } from "@/lib/base-path";
import {
  buildPeriod,
  sanitizeSemesterInput,
  sanitizeYearInput,
  suggestNextPeriod,
} from "@/lib/offer-period";

const INPUT_CLASS =
  "rounded-md border border-border bg-input px-2 py-1.5 text-center font-mono text-lg text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

/**
 * "Criar oferta" button and the dialog it opens.
 *
 * The period is typed in two boxes — year and semester — that only take what
 * fits the YEAR.SEMESTER pattern; the dialog opens on the semester after the
 * course's most recent offer. Saving goes to Payload's REST API, which is
 * also what checks that the user may create offers.
 */
export function CreateOfferDialog({
  courseId,
  existingPeriods,
  onCreated,
}: {
  courseId: string | number;
  existingPeriods: string[];
  /** Called with the new period once it is saved. */
  onCreated: (period: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onOpenChange(next: boolean) {
    if (busy) return;
    if (next) {
      const suggestion = suggestNextPeriod(existingPeriods);
      setYear(suggestion.year);
      setSemester(suggestion.semester);
      setError(null);
    }
    setOpen(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const result = buildPeriod(year, semester, existingPeriods);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(comBasePath("/api/offers?depth=0"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          period: result.period,
          course: courseId,
          status: "active",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const paths: unknown[] =
          data?.errors?.[0]?.data?.errors?.map(
            (e: { path?: unknown }) => e.path,
          ) ?? [];
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite criar ofertas. Entre novamente como administrador."
            : paths.includes("period")
              ? `A oferta ${result.period} já existe.`
              : "Não foi possível criar a oferta. Tente novamente.",
        );
        return;
      }
      setOpen(false);
      onCreated(result.period);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Criar oferta"
        onClick={() => onOpenChange(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="space-y-4">
            <DialogTitle>Criar oferta</DialogTitle>
            <DialogDescription>
              Qual oferta você quer criar? Informe o ano e o semestre.
            </DialogDescription>

            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Ano
                <input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="2027"
                  value={year}
                  onChange={(e) => setYear(sanitizeYearInput(e.target.value))}
                  disabled={busy}
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
                  disabled={busy}
                  className={`${INPUT_CLASS} w-14`}
                />
              </label>
              <span className="pb-2 text-xs text-muted-foreground">1 ou 2</span>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm" disabled={busy}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" size="sm" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
