"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { UsersThreePlusIcon } from "@/components/ui/users-three-icon";
import { comBasePath } from "@/lib/base-path";
import type { EnrollmentRow, StudentGroupOption } from "@/lib/enrollment";
import {
  MAX_GROUP_NAME_LENGTH,
  describeGroupSizes,
  parseGroupSize,
  previewGroupSizes,
  validateGroupName,
  type DrawScope,
} from "@/lib/group-draw";

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

const LABEL_CLASS =
  "mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground";

const SCOPE_CHOICES: { value: DrawScope; label: string }[] = [
  { value: "all", label: "Toda a turma" },
  { value: "classGroup", label: "Dentro de cada subturma" },
];

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs leading-relaxed text-red-900 dark:text-red-200"
    >
      {children}
    </p>
  );
}

function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-md border-l-4 border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:text-emerald-200"
    >
      {children}
    </p>
  );
}

function SectionHeading({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h3 className="flex items-baseline gap-2 font-semibold text-foreground">
        <span className="font-mono text-xs text-primary">{step}</span>
        {title}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

const countOf = (n: number) => `${n} discente${n === 1 ? "" : "s"}`;

/**
 * "Adicionar grupos" button and the floating panel it opens, with two ways
 * to create the offer's work groups:
 *
 *  1. draw them — pick how many students per group and the students still in
 *     no group are dealt at random into new groups "Grupo 1", "Grupo 2"…,
 *     among the whole class or inside each subturma (A, B);
 *  2. create one by name, empty, and keep typing names to create more.
 */
export function GroupsModal({
  offerId,
  offerPeriod,
  enrollments,
  groups,
}: {
  offerId: string | number;
  offerPeriod: string;
  enrollments: EnrollmentRow[];
  groups: StudentGroupOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Adicionar grupos"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <UsersThreePlusIcon className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="flex h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 w-screen sm:h-auto sm:max-h-[88dvh] sm:w-[min(42rem,calc(100vw-2rem))] sm:rounded-2xl sm:border"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5 sm:px-8">
            <div className="space-y-1">
              <DialogTitle className="font-serif text-xl tracking-tight">
                Adicionar grupos
              </DialogTitle>
              <DialogDescription>
                Oferta{" "}
                <span className="font-mono text-foreground">{offerPeriod}</span>
              </DialogDescription>
            </div>
            <DialogClose
              aria-label="Fechar"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={16} />
            </DialogClose>
          </header>

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6 sm:px-8">
            <DrawSection
              offerId={offerId}
              enrollments={enrollments}
              onDrawn={() => {
                // Straight back to the table, to see who landed where.
                setOpen(false);
                router.refresh();
              }}
            />
            <div className="border-t border-border/60" />
            <ManualSection
              offerId={offerId}
              groups={groups}
              onCreated={() => router.refresh()}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DrawSection({
  offerId,
  enrollments,
  onDrawn,
}: {
  offerId: string | number;
  enrollments: EnrollmentRow[];
  onDrawn: () => void;
}) {
  const [sizeText, setSizeText] = useState("4");
  const [scope, setScope] = useState<DrawScope>("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only who is in no group yet takes part: a draw never undoes a group.
  const pool = enrollments.filter(
    (row) => row.groupId === null || row.groupId === undefined,
  );
  const split = enrollments.some((row) => row.classGroup);
  const size = parseGroupSize(sizeText);
  const sizes = size === null ? [] : previewGroupSizes(pool, size, scope);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (size === null) {
      setError("Informe quantos discentes por grupo (um número inteiro).");
      return;
    }
    if (pool.length === 0) {
      setError("Não há discentes sem grupo para sortear.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(comBasePath("/api/student-groups/draw"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ offer: offerId, size, scope }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite sortear grupos. Entre novamente como administrador."
            : data?.error || "Não foi possível sortear os grupos.",
        );
        return;
      }
      onDrawn();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="groups-draw">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div id="groups-draw">
          <SectionHeading step="1" title="Sortear grupos">
            Os discentes que ainda não têm grupo são distribuídos ao acaso em
            grupos novos, com nomes genéricos (“Grupo 1”, “Grupo 2”…).
          </SectionHeading>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <label htmlFor="draw-size" className={LABEL_CLASS}>
              Discentes por grupo
            </label>
            <input
              id="draw-size"
              inputMode="numeric"
              autoComplete="off"
              value={sizeText}
              onChange={(e) =>
                setSizeText(e.target.value.replace(/\D/g, "").slice(0, 2))
              }
              disabled={busy}
              className={`${FIELD_CLASS} w-24 text-center font-mono`}
            />
          </div>

          <div className="space-y-1.5">
            <span className={LABEL_CLASS}>Sortear entre</span>
            <div
              role="radiogroup"
              aria-label="Sortear entre"
              className="inline-flex overflow-hidden rounded-md border border-border"
            >
              {SCOPE_CHOICES.map((choice) => {
                const checked = scope === choice.value;
                return (
                  <label
                    key={choice.value}
                    className={`cursor-pointer border-r border-border px-3 py-1.5 text-xs font-medium transition-colors last:border-r-0 ${
                      checked
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    } ${busy ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="draw-scope"
                      className="sr-only"
                      checked={checked}
                      disabled={busy}
                      onChange={() => setScope(choice.value)}
                    />
                    {choice.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-sm text-foreground" data-testid="draw-preview">
          {pool.length === 0 ? (
            <span className="text-muted-foreground">
              Todos os discentes desta oferta já estão em algum grupo.
            </span>
          ) : (
            <>
              <strong>{countOf(pool.length)}</strong> sem grupo
              {sizes.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  → {describeGroupSizes(sizes)}
                </span>
              )}
            </>
          )}
        </p>
        {scope === "classGroup" && !split && pool.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Esta oferta não tem subturmas A/B, então o sorteio será entre toda a
            turma.
          </p>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy || pool.length === 0}>
            {busy ? <Loader2 className="animate-spin" /> : <Shuffle />}
            Sortear grupos
          </Button>
        </div>
      </form>
    </section>
  );
}

function ManualSection({
  offerId,
  groups,
  onCreated,
}: {
  offerId: string | number;
  groups: StudentGroupOption[];
  onCreated: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  // Created in this sitting: they count as taken before the page refreshes.
  const [created, setCreated] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const checked = validateGroupName(name, [
      ...groups.map((group) => group.name),
      ...created,
    ]);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(comBasePath("/api/student-groups?depth=0"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: checked.name, offer: offerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const paths: unknown[] =
          data?.errors?.[0]?.data?.errors?.map(
            (e: { path?: unknown }) => e.path,
          ) ?? [];
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite criar grupos. Entre novamente como administrador."
            : paths.includes("name")
              ? `Já existe um grupo chamado “${checked.name}”.`
              : "Não foi possível criar o grupo. Tente novamente.",
        );
        return;
      }
      setCreated((current) => [...current, checked.name]);
      setName("");
      onCreated();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
      // Ready for the next name even when "Inserir" was clicked.
      input.current?.focus();
    }
  }

  return (
    <section aria-labelledby="groups-manual">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div id="groups-manual">
          <SectionHeading step="2" title="Criar um grupo manualmente">
            O grupo nasce vazio. Depois de inserir, o campo fica pronto para o
            próximo nome.
          </SectionHeading>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="group-name" className={LABEL_CLASS}>
              Nome do grupo
            </label>
            <input
              ref={input}
              id="group-name"
              autoComplete="off"
              placeholder="RBA Engenharia"
              maxLength={MAX_GROUP_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              // Read-only, not disabled, while saving: a disabled field
              // drops the focus, and the next name could not be typed
              // straight away.
              readOnly={busy}
              className={FIELD_CLASS}
            />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Inserir
          </Button>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        {created.length > 0 && (
          <SuccessNote>
            {created.length === 1 ? "Grupo criado" : "Grupos criados"}:{" "}
            {created.join(", ")}.
          </SuccessNote>
        )}
      </form>
    </section>
  );
}
