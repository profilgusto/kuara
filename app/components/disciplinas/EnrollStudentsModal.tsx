"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { comBasePath } from "@/lib/base-path";
import {
  classGroupLabel,
  parseClassGroup,
  validateStudent,
  type ClassGroup,
} from "@/lib/enrollment";
import { MAX_SHEET_BYTES, readSheetRows } from "@/lib/sheet-reader";
import { extractSigaaRoster, type SigaaRoster } from "@/lib/sigaa-roster";

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

const LABEL_CLASS =
  "mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground";

const GROUP_CHOICES: (ClassGroup | null)[] = [null, "A", "B"];

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

function WarningNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border-l-4 border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
      {children}
    </p>
  );
}

/** "1 discente" / "24 discentes". */
const countOf = (n: number) => `${n} discente${n === 1 ? "" : "s"}`;

/** Whole class, turma A or turma B — as radio buttons. */
function ClassGroupPicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: ClassGroup | null;
  onChange: (value: ClassGroup | null) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Turma"
      className="inline-flex overflow-hidden rounded-md border border-border"
    >
      {GROUP_CHOICES.map((choice) => {
        const checked = value === choice;
        return (
          <label
            key={choice ?? "all"}
            className={`cursor-pointer border-r border-border px-3 py-1.5 text-xs font-medium transition-colors last:border-r-0 ${
              checked
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            } ${disabled ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(choice)}
            />
            {classGroupLabel(choice)}
          </label>
        );
      })}
    </div>
  );
}

/**
 * "Cadastrar aluno(s)" button and the floating panel it opens, with two ways
 * to enrol students in the offer on screen:
 *
 *  1. upload the class's "planilha de notas" exported from SIGAA — the
 *     matrículas and names are read in the browser, shown for review, and
 *     only then sent;
 *  2. type one student's matrícula and name.
 *
 * Either way the student lands in a turma: the whole class, A or B.
 */
export function EnrollStudentsModal({
  offerId,
  offerPeriod,
  enrolledRegistrations,
}: {
  offerId: string | number;
  offerPeriod: string;
  enrolledRegistrations: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cadastrar aluno(s)"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <UserPlus className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="flex h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 w-screen sm:h-auto sm:max-h-[88dvh] sm:w-[min(42rem,calc(100vw-2rem))] sm:rounded-2xl sm:border"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5 sm:px-8">
            <div className="space-y-1">
              <DialogTitle className="font-serif text-xl tracking-tight">
                Cadastrar aluno(s)
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
            <SheetSection
              offerId={offerId}
              offerPeriod={offerPeriod}
              enrolledRegistrations={enrolledRegistrations}
              onSaved={() => router.refresh()}
            />
            <div className="border-t border-border/60" />
            <ManualSection
              offerId={offerId}
              enrolledRegistrations={enrolledRegistrations}
              onSaved={() => router.refresh()}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
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

function SheetSection({
  offerId,
  offerPeriod,
  enrolledRegistrations,
  onSaved,
}: {
  offerId: string | number;
  offerPeriod: string;
  enrolledRegistrations: string[];
  onSaved: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [classGroup, setClassGroup] = useState<ClassGroup | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [roster, setRoster] = useState<SigaaRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);

  function reset() {
    setRoster(null);
    setFileName(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    setResult(null);
    setRoster(null);
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    if (file.size > MAX_SHEET_BYTES) {
      setError("O arquivo é grande demais para uma planilha de turma.");
      return;
    }

    setBusy("reading");
    try {
      const extracted = extractSigaaRoster(
        await readSheetRows(await file.arrayBuffer()),
      );
      if (!extracted.ok) {
        setError(extracted.error);
        return;
      }
      setRoster(extracted.roster);
      // The sheet's own title says which half of the class it is.
      setClassGroup(extracted.roster.classGroup);
    } catch {
      setError(
        "Não foi possível ler o arquivo. Envie a planilha .xls exportada do SIGAA.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!roster || busy) return;
    setBusy("saving");
    setError(null);
    try {
      const res = await fetch(comBasePath("/api/enrollments/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          offer: offerId,
          classGroup,
          students: roster.students,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite cadastrar discentes. Entre novamente como administrador."
            : data?.error || "Não foi possível cadastrar os discentes.",
        );
        return;
      }
      const parts = [
        `${countOf(data.created)} cadastrado${data.created === 1 ? "" : "s"}`,
      ];
      if (data.updated) parts.push(`${data.updated} atualizado(s)`);
      if (data.unchanged)
        parts.push(`${data.unchanged} já estava(m) na oferta`);
      setResult(`${parts.join(", ")} — ${classGroupLabel(classGroup)}.`);
      reset();
      onSaved();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  const enrolled = new Set(enrolledRegistrations);
  const alreadyThere = roster
    ? roster.students.filter((s) => enrolled.has(s.registration)).length
    : 0;

  return (
    <section aria-labelledby="enroll-sheet" className="space-y-4">
      <div id="enroll-sheet">
        <SectionHeading step="1" title="Importar planilha do SIGAA">
          Envie a planilha de notas da turma (.xls). As matrículas e os nomes
          são lidos automaticamente; nada é cadastrado antes de você conferir.
        </SectionHeading>
      </div>

      <div className="space-y-1.5">
        <span className={LABEL_CLASS}>Esta planilha é da</span>
        <ClassGroupPicker
          name="sheet-class-group"
          value={classGroup}
          onChange={setClassGroup}
          disabled={busy !== null}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          id="enroll-file"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={pickFile}
          disabled={busy !== null}
          className="sr-only"
        />
        <label
          htmlFor="enroll-file"
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {busy === "reading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-primary" />
          )}
          {fileName ? "Trocar planilha" : "Escolher planilha"}
        </label>
        {fileName && (
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {fileName}
          </span>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {result && <SuccessNote>{result}</SuccessNote>}

      {roster && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            <strong>{countOf(roster.students.length)}</strong> na planilha
            {roster.courseCode && (
              <span className="text-muted-foreground">
                {" "}
                · {roster.courseCode}
                {roster.classCode && `, turma ${roster.classCode}`}
                {roster.period && `, ${roster.period}`}
              </span>
            )}
          </p>

          {roster.period && roster.period !== offerPeriod && (
            <WarningNote>
              A planilha é de {roster.period}, mas a oferta aberta é{" "}
              {offerPeriod}. Confira antes de cadastrar.
            </WarningNote>
          )}
          {roster.skippedRows > 0 && (
            <WarningNote>
              {roster.skippedRows} linha(s) sem matrícula ou nome válidos foram
              ignoradas.
            </WarningNote>
          )}
          {alreadyThere > 0 && (
            <p className="text-xs text-muted-foreground">
              {alreadyThere} já {alreadyThere === 1 ? "está" : "estão"} nesta
              oferta: {alreadyThere === 1 ? "será mantido" : "serão mantidos"},
              com o nome e a turma desta planilha.
            </p>
          )}

          <div className="max-h-56 overflow-y-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-popover">
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="w-32 px-3 py-2 font-semibold">
                    Matrícula
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Nome
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {roster.students.map((student) => (
                  <tr key={student.registration}>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                      {student.registration}
                    </td>
                    <td className="px-3 py-1.5">{student.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={reset}
            >
              Descartar planilha
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy !== null}
              onClick={save}
            >
              {busy === "saving" && <Loader2 className="animate-spin" />}
              Cadastrar {countOf(roster.students.length)} ·{" "}
              {classGroupLabel(classGroup)}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ManualSection({
  offerId,
  enrolledRegistrations,
  onSaved,
}: {
  offerId: string | number;
  enrolledRegistrations: string[];
  onSaved: () => void;
}) {
  const [registration, setRegistration] = useState("");
  const [name, setName] = useState("");
  const [classGroup, setClassGroup] = useState<ClassGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setResult(null);

    const checked = validateStudent(registration, name);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    const duplicate = `A matrícula ${checked.student.registration} já está cadastrada nesta oferta.`;
    if (enrolledRegistrations.includes(checked.student.registration)) {
      setError(duplicate);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(comBasePath("/api/enrollments?depth=0"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          offer: offerId,
          ...checked.student,
          classGroup,
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
            ? "Sua sessão não permite cadastrar discentes. Entre novamente como administrador."
            : paths.includes("registration")
              ? duplicate
              : "Não foi possível cadastrar o discente. Tente novamente.",
        );
        return;
      }
      setResult(
        `${checked.student.name} cadastrado(a) — ${classGroupLabel(classGroup)}.`,
      );
      setRegistration("");
      setName("");
      onSaved();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="enroll-manual">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div id="enroll-manual">
          <SectionHeading step="2" title="Cadastrar manualmente">
            Para incluir um discente que não está na planilha.
          </SectionHeading>
        </div>

        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="enroll-registration" className={LABEL_CLASS}>
              Matrícula
            </label>
            <input
              id="enroll-registration"
              inputMode="numeric"
              autoComplete="off"
              value={registration}
              onChange={(e) =>
                setRegistration(e.target.value.replace(/\D/g, "").slice(0, 20))
              }
              disabled={busy}
              className={`${FIELD_CLASS} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="enroll-name" className={LABEL_CLASS}>
              Nome
            </label>
            <input
              id="enroll-name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <span className={LABEL_CLASS}>Turma</span>
            <ClassGroupPicker
              name="manual-class-group"
              value={classGroup}
              onChange={(value) => setClassGroup(parseClassGroup(value))}
              disabled={busy}
            />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Cadastrar discente
          </Button>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        {result && <SuccessNote>{result}</SuccessNote>}
      </form>
    </section>
  );
}
