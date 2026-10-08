"use client";

import {
  Fragment,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { FilePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { comBasePath } from "@/lib/base-path";
import { AssessmentTasksModal } from "./AssessmentTasksModal";
import {
  EMPTY_ASSESSMENT_DRAFT,
  SEMESTER_POINTS,
  MAX_ASSESSMENT_COMMENT_LENGTH,
  categoryLabel,
  dueDateToStored,
  formatDueDate,
  formatPoints,
  modeLabel,
  sanitizeCodeInput,
  scoringUnitLabel,
  scoringUnitToActivityType,
  sumAssessments,
  validateAssessment,
  type AssessmentDraft,
  type AssessmentRow,
} from "@/lib/assessment";

type RowId = AssessmentRow["id"];

/** The row being typed into: a new one, or an existing one being changed. */
type OpenForm = { mode: "new" } | { mode: "edit"; id: RowId };

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

const ICON_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

const ROW_ICON_CLASS =
  "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-30";

const FORM_ID = "assessment-form";

const draftFromRow = (row: AssessmentRow): AssessmentDraft => ({
  code: row.code,
  name: row.name,
  weight: formatPoints(row.weight),
  category: row.category,
  scoredBy: row.scoredBy,
  mode: row.mode,
  dueDate: row.dueDate ?? "",
  comment: row.comment ?? "",
});

/**
 * The assessments of the offer on screen: code, name, points, whether each
 * counts toward the semester's 10.0 ("regular") or is bonus ("extra"),
 * whether it is graded per student or per work group, and how: with one
 * mark ("Nota") or by ticking off small tasks ("Tarefas"), whose list is
 * edited from that cell while the table is in edit mode.
 *
 * The document-plus button opens a new row at the end of the table itself,
 * with the four fields to fill in and Salvar / Descartar on its right. The
 * pencil beside it switches on the table's edit mode: each row then gets its
 * own pencil — which turns that row into the same kind of editable row — and
 * a bin that removes the assessment after a confirmation beside it.
 *
 * The footer adds the points up on one line; the regular sum shows in red
 * until it is exactly 10.0.
 */
export function AssessmentTable({
  offerId,
  assessments,
}: {
  offerId: string | number;
  assessments: AssessmentRow[];
}) {
  const router = useRouter();
  // What is on screen. It runs ahead of the `assessments` prop between a
  // change made here and the server re-render that follows it.
  const [rows, setRows] = useState(assessments);
  useEffect(() => setRows(assessments), [assessments]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OpenForm | null>(null);
  const [draft, setDraft] = useState<AssessmentDraft>(EMPTY_ASSESSMENT_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The assessment whose removal is awaiting confirmation.
  const [removingId, setRemovingId] = useState<RowId | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const totals = sumAssessments(rows);
  const showActions = editing || form !== null;
  const columns = showActions ? 9 : 8;
  // The checklist assessment whose tasks are being edited, if any.
  const [tasksOf, setTasksOf] = useState<RowId | null>(null);
  const tasksAssessment = rows.find((row) => row.id === tasksOf) ?? null;

  function openNew() {
    setError(null);
    setDraft(EMPTY_ASSESSMENT_DRAFT);
    setForm({ mode: "new" });
  }

  function openEdit(row: AssessmentRow) {
    setError(null);
    setDraft(draftFromRow(row));
    setForm({ mode: "edit", id: row.id });
  }

  function discard() {
    setError(null);
    setForm(null);
  }

  function toggleEditing() {
    // Leaving edit mode drops a row left open for editing, unsaved.
    if (editing && form?.mode === "edit" && !busy) discard();
    setRemovingId(null);
    setEditing((on) => !on);
  }

  function set<K extends keyof AssessmentDraft>(
    key: K,
    value: AssessmentDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || busy) return;

    const editedId = form.mode === "edit" ? form.id : null;
    const checked = validateAssessment(
      draft,
      rows.filter((row) => row.id !== editedId).map((row) => row.code),
    );
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    const { code, name, weight, category, scoredBy } = checked.assessment;
    const fields = {
      acronym: code,
      description: name,
      weight,
      category,
      // Payload's own name for "scored by": individual | group.
      type: scoringUnitToActivityType(scoredBy),
      mode: checked.assessment.mode,
      // null clears what was there.
      dueDate: dueDateToStored(checked.assessment.dueDate),
      comment: checked.assessment.comment || null,
    };

    setBusy(true);
    setError(null);
    try {
      const res =
        editedId === null
          ? await fetch(comBasePath("/api/activities?depth=0"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                offer: offerId,
                ...fields,
                order: rows.length,
              }),
            })
          : await fetch(comBasePath(`/api/activities/${editedId}?depth=0`), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(fields),
            });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const paths: unknown[] =
          data?.errors?.[0]?.data?.errors?.map(
            (e: { path?: unknown }) => e.path,
          ) ?? [];
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite alterar avaliações. Entre novamente como administrador."
            : paths.includes("acronym")
              ? `Já existe uma avaliação com o código ${code}.`
              : "Não foi possível salvar a avaliação. Tente novamente.",
        );
        return;
      }
      setRows((current) =>
        editedId === null
          ? [
              ...current,
              {
                id: data?.doc?.id ?? `new-${code}`,
                ...checked.assessment,
                tasks: [],
              },
            ]
          : current.map((row) =>
              row.id === editedId ? { ...row, ...checked.assessment } : row,
            ),
      );
      setForm(null);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AssessmentRow) {
    if (busy) return;
    setBusy(true);
    setRemoveError(null);
    try {
      const res = await fetch(comBasePath(`/api/activities/${row.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      // 404: already gone (another tab) — the outcome asked for.
      if (!res.ok && res.status !== 404) {
        setRemoveError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite remover avaliações. Entre novamente como administrador."
            : "Não foi possível remover a avaliação. Tente novamente.",
        );
        return;
      }
      setRows((current) => current.filter((r) => r.id !== row.id));
      setRemovingId(null);
      router.refresh();
    } catch {
      setRemoveError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      discard();
    }
  }

  /** The cells of the row being typed into — new or existing alike. */
  const editorRow = (key: string) => (
    <Fragment key={key}>
      <tr className="bg-primary/5 align-top" onKeyDown={onKeyDown}>
        <td className="px-4 py-2">
          <input
            form={FORM_ID}
            autoFocus
            aria-label="Código"
            placeholder="P1"
            autoComplete="off"
            value={draft.code}
            onChange={(e) => set("code", sanitizeCodeInput(e.target.value))}
            disabled={busy}
            className={`${INPUT_CLASS} font-mono`}
          />
        </td>
        <td className="px-4 py-2">
          <input
            form={FORM_ID}
            aria-label="Nome"
            placeholder="Prova Prática"
            autoComplete="off"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={busy}
            className={INPUT_CLASS}
          />
          {error && (
            <p
              role="alert"
              className="mt-2 rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
            >
              {error}
            </p>
          )}
        </td>
        <td className="px-4 py-2">
          <input
            form={FORM_ID}
            aria-label="Peso"
            placeholder="2.5"
            inputMode="decimal"
            autoComplete="off"
            value={draft.weight}
            onChange={(e) =>
              set("weight", e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))
            }
            disabled={busy}
            className={`${INPUT_CLASS} text-right font-mono`}
          />
        </td>
        <td className="px-4 py-2">
          <select
            form={FORM_ID}
            aria-label="Tipo pontuação"
            value={draft.category}
            onChange={(e) =>
              set("category", e.target.value === "extra" ? "extra" : "regular")
            }
            disabled={busy}
            className={INPUT_CLASS}
          >
            <option value="regular">Regular</option>
            <option value="extra">Extra</option>
          </select>
        </td>
        <td className="px-4 py-2">
          <select
            form={FORM_ID}
            aria-label="Pontuação por"
            value={draft.scoredBy}
            onChange={(e) =>
              set("scoredBy", e.target.value === "group" ? "group" : "student")
            }
            disabled={busy}
            className={INPUT_CLASS}
          >
            <option value="student">Discente</option>
            <option value="group">Grupo</option>
          </select>
        </td>
        <td className="px-4 py-2">
          <select
            form={FORM_ID}
            aria-label="Avaliada por"
            value={draft.mode}
            onChange={(e) =>
              set(
                "mode",
                e.target.value === "checklist" ? "checklist" : "graded",
              )
            }
            disabled={busy}
            className={INPUT_CLASS}
          >
            <option value="graded">Nota</option>
            <option value="checklist">Tarefas</option>
          </select>
        </td>
        <td colSpan={3} className="px-4 py-2">
          <div className="flex items-center justify-end gap-2">
            <Button type="submit" form={FORM_ID} size="sm" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={discard}
            >
              Descartar
            </Button>
          </div>
        </td>
      </tr>
      <tr className="bg-primary/5 align-top" onKeyDown={onKeyDown}>
        <td colSpan={columns} className="px-4 pb-3 pt-0">
          <div className="flex flex-wrap items-start gap-4">
            <label className="block w-44 shrink-0">
              <span className="mb-1 block text-xs text-muted-foreground">
                Entrega
              </span>
              <input
                form={FORM_ID}
                type="date"
                aria-label="Entrega"
                value={draft.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                disabled={busy}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block min-w-48 flex-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                Comentário
              </span>
              <textarea
                form={FORM_ID}
                aria-label="Comentário"
                rows={1}
                maxLength={MAX_ASSESSMENT_COMMENT_LENGTH}
                value={draft.comment}
                onChange={(e) => set("comment", e.target.value)}
                disabled={busy}
                className={`${INPUT_CLASS} resize-y`}
              />
            </label>
          </div>
        </td>
      </tr>
    </Fragment>
  );

  return (
    <section
      aria-label="Avaliações da oferta"
      className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Avaliações
        </h2>
        <span className="text-sm text-muted-foreground">{rows.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={toggleEditing}
            aria-pressed={editing}
            aria-label={
              editing
                ? "Sair da edição da tabela"
                : "Editar tabela de avaliações"
            }
            className={`${ICON_BUTTON_CLASS} ${
              editing
                ? "bg-primary text-primary-foreground hover:bg-primary/85"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={openNew}
            disabled={form !== null}
            aria-label="Cadastrar avaliação"
            className={`${ICON_BUTTON_CLASS} text-muted-foreground hover:bg-muted hover:text-foreground`}
          >
            <FilePlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* The editable row's fields sit in table cells; this form, outside
          the table, is what they submit through (`form` attribute). */}
      <form id={FORM_ID} onSubmit={save} noValidate />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="w-32 px-4 py-3 font-semibold">
                Código
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Nome
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-right font-semibold"
              >
                Peso
              </th>
              <th scope="col" className="w-36 px-4 py-3 font-semibold">
                Tipo pontuação
              </th>
              <th scope="col" className="w-36 px-4 py-3 font-semibold">
                Pontuação por
              </th>
              <th scope="col" className="w-36 px-4 py-3 font-semibold">
                Avaliada por
              </th>
              <th scope="col" className="w-36 px-4 py-3 font-semibold">
                Entrega
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Comentário
              </th>
              {showActions && (
                <th
                  scope="col"
                  className={`px-4 py-3 ${form ? "w-56" : "w-24"}`}
                >
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((row) =>
              form?.mode === "edit" && form.id === row.id ? (
                editorRow(`edit-${row.id}`)
              ) : (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">
                    {row.code}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {formatPoints(row.weight)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.category === "extra" ? (
                      <span className="rounded bg-secondary/15 px-1.5 py-0.5 text-xs font-medium text-secondary">
                        Extra
                      </span>
                    ) : (
                      categoryLabel(row.category)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {scoringUnitLabel(row.scoredBy)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.mode !== "checklist" ? (
                      modeLabel(row.mode)
                    ) : editing ? (
                      <button
                        type="button"
                        onClick={() => setTasksOf(row.id)}
                        disabled={form !== null}
                        aria-label={`Editar as tarefas de ${row.code}`}
                        data-tooltip="Editar tarefas"
                        className="rounded-md border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                      >
                        Tarefas · {row.tasks.length}
                      </button>
                    ) : (
                      <span
                        className={
                          row.tasks.length === 0
                            ? "text-amber-700 dark:text-amber-300"
                            : undefined
                        }
                      >
                        Tarefas · {row.tasks.length}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {formatDueDate(row.dueDate) || "—"}
                  </td>
                  <td className="max-w-64 whitespace-pre-line px-4 py-2.5 text-xs text-muted-foreground">
                    {row.comment}
                  </td>
                  {showActions && (
                    <td className="px-4 py-1">
                      {editing && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            disabled={form !== null}
                            aria-label={`Editar ${row.code}`}
                            className={`${ROW_ICON_CLASS} text-muted-foreground/70 hover:bg-muted hover:text-primary focus-visible:ring-ring`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <Popover
                            open={removingId === row.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setRemoveError(null);
                                setRemovingId(row.id);
                              } else if (!busy) {
                                setRemovingId(null);
                              }
                            }}
                          >
                            <PopoverTrigger
                              disabled={form !== null}
                              aria-label={`Remover ${row.code}`}
                              className={`${ROW_ICON_CLASS} text-red-600/60 hover:bg-red-500/10 hover:text-red-600 focus-visible:ring-red-500/50 data-[state=open]:bg-red-500/10 data-[state=open]:text-red-600 dark:text-red-400/60 dark:hover:text-red-400`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </PopoverTrigger>
                            <PopoverContent
                              side="left"
                              align="center"
                              sideOffset={8}
                              aria-label="Remover avaliação?"
                              className="w-72 space-y-3 p-3 text-left duration-75"
                            >
                              <p className="text-sm font-semibold text-foreground">
                                Remover avaliação?
                              </p>
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                <strong className="text-foreground">
                                  {row.code}
                                </strong>{" "}
                                ({row.name}, {formatPoints(row.weight)}{" "}
                                {row.weight === 1 ? "ponto" : "pontos"}) sairá
                                desta oferta. Não dá para desfazer.
                              </p>
                              {removeError && (
                                <p
                                  role="alert"
                                  className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
                                >
                                  {removeError}
                                </p>
                              )}
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => setRemovingId(null)}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => remove(row)}
                                >
                                  {busy && <Loader2 className="animate-spin" />}
                                  Remover
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ),
            )}

            {rows.length === 0 && !form && (
              <tr>
                <td
                  colSpan={columns}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Nenhuma avaliação cadastrada nesta oferta.
                </td>
              </tr>
            )}

            {form?.mode === "new" && editorRow("new")}
          </tbody>
          <tfoot className="border-t border-border/60 bg-muted/30">
            <tr>
              <td colSpan={columns} className="px-4 py-2.5">
                <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                  <div className="flex items-baseline gap-2">
                    <dt className="text-muted-foreground">Regulares</dt>
                    <dd
                      data-total="regular"
                      data-complete={totals.regularIsComplete}
                      className={`font-mono font-semibold tabular-nums ${
                        totals.regularIsComplete
                          ? "text-foreground"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatPoints(totals.regular)}
                    </dd>
                    {!totals.regularIsComplete && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        deve somar {formatPoints(SEMESTER_POINTS)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="text-muted-foreground">Extras</dt>
                    <dd data-total="extra" className="font-mono tabular-nums">
                      {formatPoints(totals.extra)}
                    </dd>
                  </div>
                  <div className="ml-auto flex items-baseline gap-2">
                    <dt className="font-semibold">Total</dt>
                    <dd
                      data-total="total"
                      className="font-mono font-semibold tabular-nums"
                    >
                      {formatPoints(totals.total)}
                    </dd>
                  </div>
                </dl>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {tasksAssessment && (
        <AssessmentTasksModal
          // Remounted per assessment: the panel starts from its saved tasks.
          key={tasksAssessment.id}
          assessment={tasksAssessment}
          open
          onOpenChange={(open) => {
            if (!open) setTasksOf(null);
          }}
          onSaved={(tasks) => {
            setRows((current) =>
              current.map((row) =>
                row.id === tasksAssessment.id ? { ...row, tasks } : row,
              ),
            );
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
