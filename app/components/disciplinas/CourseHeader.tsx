"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditablePage } from "@/components/layout/EditModeContext";
import { useSession } from "@/components/layout/SessionContext";
import { comBasePath } from "@/lib/base-path";
import {
  buildCoursePatch,
  draftFromCourse,
  formatWorkload,
  saveErrorMessage,
  type CourseDraft,
  type CourseField,
  type CourseWorkload,
} from "@/lib/course-edit";

export interface CourseHeaderData {
  id: string | number;
  title: string;
  code: string;
  summary?: string | null;
  workload?: CourseWorkload | null;
}

/** A link next to the title, to another section of the same course. */
export interface CourseSectionLink {
  label: string;
  href: string;
  /** Show it to a signed-in admin only. */
  adminOnly?: boolean;
}

const INPUT_CLASS =
  "rounded-md border border-border bg-input px-2 py-1 text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

const FIELD_LABEL: Record<CourseField, string> = {
  title: "nome da disciplina",
  code: "código",
  workload: "carga horária",
  summary: "descrição",
};

/**
 * Title, code, workload and summary at the top of a course page.
 *
 * For a visitor it is plain text. In edit mode (an admin, after turning it on
 * from the top bar) each of the four gets a pencil that swaps the text for an
 * edit box in place, saved one field at a time to Payload's REST API — which
 * is also what checks that the user may write.
 *
 * `sectionLink` puts a discreet button beside the title: "Ofertas" on the
 * course page, "Módulos" on the offers page.
 */
export function CourseHeader({
  course,
  sectionLink,
  editable = true,
}: {
  course: CourseHeaderData;
  sectionLink?: CourseSectionLink;
  /** False shows the header read-only, with no pencil in the top bar. */
  editable?: boolean;
}) {
  const router = useRouter();
  const editing = useEditablePage(editable);
  const { session } = useSession();
  const showSectionLink =
    sectionLink && (!sectionLink.adminOnly || session?.role === "admin");

  // What was last saved here. It runs ahead of the `course` prop between a
  // save and the server re-render that follows it.
  const [saved, setSaved] = useState(course);
  const [openField, setOpenField] = useState<CourseField | null>(null);
  const [draft, setDraft] = useState<CourseDraft>(() =>
    draftFromCourse(course),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSaved(course);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    course.id,
    course.title,
    course.code,
    course.summary,
    course.workload?.theoretical,
    course.workload?.practical,
  ]);

  // Leaving edit mode drops whatever was open, unsaved.
  useEffect(() => {
    if (!editing) setOpenField(null);
  }, [editing]);

  function open(field: CourseField) {
    setDraft(draftFromCourse(saved));
    setError(null);
    setOpenField(field);
  }

  function discard() {
    setError(null);
    setOpenField(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!openField || busy) return;

    const result = buildCoursePatch(openField, draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(comBasePath(`/api/courses/${saved.id}?depth=0`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(result.patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(saveErrorMessage(res.status, data));
        return;
      }
      setSaved((current) => ({ ...current, ...result.patch }));
      setOpenField(null);
      // The page title, breadcrumbs and anything else rendered on the server
      // from this course need to catch up.
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof CourseDraft>(key: K) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value }));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      discard();
    }
  }

  const pencil = (field: CourseField) =>
    editing &&
    openField === null && (
      <button
        type="button"
        onClick={() => open(field)}
        aria-label={`Editar ${FIELD_LABEL[field]}`}
        title={`Editar ${FIELD_LABEL[field]}`}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={busy}>
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
        Descartar alterações
      </Button>
    </div>
  );

  const errorNote = error && (
    <p
      role="alert"
      className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
    >
      {error}
    </p>
  );

  const editBox = (children: ReactNode, className: string) => (
    <form
      onSubmit={save}
      onKeyDown={onKeyDown}
      noValidate
      className={className}
    >
      {children}
    </form>
  );

  const workloadText = formatWorkload(saved.workload);
  const metaOpen = openField === "code" || openField === "workload";

  return (
    <header className="space-y-2">
      {openField === "title" ? (
        editBox(
          <>
            <input
              autoFocus
              aria-label="Nome da disciplina"
              value={draft.title}
              onChange={set("title")}
              disabled={busy}
              className={`${INPUT_CLASS} w-full font-serif text-3xl font-bold tracking-tight`}
            />
            {errorNote}
            {actions}
          </>,
          "space-y-2",
        )
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{saved.title}</h1>
            {pencil("title")}
          </div>
          {showSectionLink && (
            <Link
              href={sectionLink.href}
              className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {sectionLink.label}
            </Link>
          )}
        </div>
      )}

      <div
        className={`flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground ${
          metaOpen ? "items-start" : "items-center"
        }`}
      >
        {openField === "code" ? (
          editBox(
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  aria-label="Código"
                  value={draft.code}
                  onChange={set("code")}
                  disabled={busy}
                  className={`${INPUT_CLASS} w-36 font-mono text-sm`}
                />
                {actions}
              </div>
              {errorNote}
            </>,
            "w-full space-y-2",
          )
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="font-mono">{saved.code}</span>
            {pencil("code")}
          </span>
        )}

        {openField === "workload"
          ? editBox(
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      autoFocus
                      inputMode="numeric"
                      aria-label="Horas teóricas"
                      value={draft.theoretical}
                      onChange={set("theoretical")}
                      disabled={busy}
                      className={`${INPUT_CLASS} w-16 text-right text-sm`}
                    />
                    h teórica
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      inputMode="numeric"
                      aria-label="Horas práticas"
                      value={draft.practical}
                      onChange={set("practical")}
                      disabled={busy}
                      className={`${INPUT_CLASS} w-16 text-right text-sm`}
                    />
                    h prática
                  </label>
                  {actions}
                </div>
                {errorNote}
              </>,
              "w-full space-y-2",
            )
          : (workloadText || editing) && (
              <span className="inline-flex items-center gap-1">
                {workloadText ? (
                  <span>{workloadText}</span>
                ) : (
                  <span className="italic text-muted-foreground/60">
                    Sem carga horária
                  </span>
                )}
                {pencil("workload")}
              </span>
            )}
      </div>

      {openField === "summary"
        ? editBox(
            <>
              <textarea
                autoFocus
                aria-label="Descrição"
                rows={7}
                value={draft.summary}
                onChange={set("summary")}
                disabled={busy}
                className={`${INPUT_CLASS} block w-full text-base leading-relaxed`}
              />
              {errorNote}
              {actions}
            </>,
            "max-w-2xl space-y-2",
          )
        : (saved.summary || editing) && (
            <div className="flex items-start gap-2">
              {saved.summary ? (
                <p className="max-w-2xl whitespace-pre-line text-muted-foreground">
                  {saved.summary}
                </p>
              ) : (
                <p className="italic text-muted-foreground/60">Sem descrição</p>
              )}
              {pencil("summary")}
            </div>
          )}
    </header>
  );
}
