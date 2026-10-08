"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPoints, type AssessmentRow } from "@/lib/assessment";
import type { EnrollmentRow } from "@/lib/enrollment";
import type { ScoreRow } from "@/lib/grades";
import {
  MAX_SHEET_BYTES,
  patchXlsNumbers,
  readSheetRows,
} from "@/lib/sheet-reader";
import {
  buildGradeExport,
  exportFileName,
  readGradeSheetLayout,
  type GradeSheetLayout,
} from "@/lib/sigaa-export";

const LABEL_CLASS =
  "mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground";

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

const countOf = (n: number) => `${n} discente${n === 1 ? "" : "s"}`;

/** Hands the browser a file to save. */
function saveFile(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/vnd.ms-excel" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * "Baixar notas para o SIGAA" button and the floating panel it opens.
 *
 * SIGAA takes grades back in the very sheet it exports for the class, so
 * that sheet is the template: the teacher picks it, the panel shows how it
 * lines up with this offer (assessments by code, students by matrícula), and
 * the download is the same file with the grades filled in — in points, one
 * decimal — and nothing else changed.
 *
 * The sheet decides what is sent: only the assessments SIGAA has columns
 * for, and only the students listed in it — each half of a split class has
 * its own sheet.
 *
 * SIGAA only has the regular assessments. When the offer has bonus ones, the
 * panel asks whether to fold each student's bonus points into their regular
 * grades, without ever passing an assessment's maximum.
 */
export function SigaaExportModal({
  offerPeriod,
  enrollments,
  assessments,
  scores,
}: {
  offerPeriod: string;
  enrollments: EnrollmentRow[];
  assessments: AssessmentRow[];
  scores: ScoreRow[];
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; data: ArrayBuffer } | null>(
    null,
  );
  const [layout, setLayout] = useState<GradeSheetLayout | null>(null);
  const [withExtras, setWithExtras] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reading" | "writing" | null>(null);

  const hasExtras = assessments.some((a) => a.category === "extra");
  const plan = useMemo(
    () =>
      layout
        ? buildGradeExport({
            layout,
            enrollments,
            assessments,
            scores,
            withExtras: withExtras && hasExtras,
          })
        : null,
    [layout, enrollments, assessments, scores, withExtras, hasExtras],
  );

  function reset() {
    setFile(null);
    setLayout(null);
    setError(null);
    setDone(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    setError(null);
    setDone(null);
    setLayout(null);
    setFile(null);
    if (!picked) return;
    if (picked.size > MAX_SHEET_BYTES) {
      setError("O arquivo é grande demais para uma planilha de turma.");
      return;
    }

    setBusy("reading");
    try {
      const data = await picked.arrayBuffer();
      const read = readGradeSheetLayout(await readSheetRows(data));
      if (!read.ok) {
        setError(read.error);
        return;
      }
      setFile({ name: picked.name, data });
      setLayout(read.layout);
    } catch {
      setError(
        "Não foi possível ler o arquivo. Envie a planilha .xls exportada do SIGAA.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    if (!file || !plan || busy) return;
    setBusy("writing");
    setError(null);
    setDone(null);
    try {
      const { file: bytes, result } = await patchXlsNumbers(
        file.data,
        plan.cells,
      );
      if (result.encrypted) {
        setError(
          "Esta planilha está protegida por senha de abertura e não pode ser preenchida.",
        );
        return;
      }
      if (result.skipped.length > 0) {
        setError(
          `${result.skipped.length} célula(s) de nota não puderam ser preenchidas nesta planilha. Exporte-a de novo do SIGAA, sem editá-la, e tente outra vez.`,
        );
        return;
      }
      const name = exportFileName(file.name, withExtras && hasExtras);
      saveFile(bytes, name);
      setDone(`${name} baixado, com ${result.written} nota(s) preenchida(s).`);
    } catch {
      setError(
        "Não foi possível gerar o arquivo. A planilha precisa ser o .xls original do SIGAA.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Baixar notas para o SIGAA"
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Download className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          if (!next) reset();
          setOpen(next);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="flex h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 w-screen sm:h-auto sm:max-h-[88dvh] sm:w-[min(42rem,calc(100vw-2rem))] sm:rounded-2xl sm:border"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5 sm:px-8">
            <div className="space-y-1">
              <DialogTitle className="font-serif text-xl tracking-tight">
                Baixar notas para o SIGAA
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

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Envie a planilha de notas da turma, exportada do SIGAA depois de
              cadastrar as avaliações lá com as mesmas abreviações daqui. O
              Kuara devolve a mesma planilha com as notas preenchidas, pronta
              para ser enviada de volta. Só entram os discentes e as avaliações
              que estão na planilha; cada subturma (A, B) tem a sua.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                id="sigaa-export-file"
                type="file"
                accept=".xls,application/vnd.ms-excel"
                onChange={pickFile}
                disabled={busy !== null}
                className="sr-only"
              />
              <label
                htmlFor="sigaa-export-file"
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted ${
                  busy ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {busy === "reading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                )}
                {file ? "Trocar planilha" : "Escolher planilha do SIGAA"}
              </label>
              {file && (
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                  {file.name}
                </span>
              )}
            </div>

            {layout && plan && (
              <div className="space-y-4">
                <p className="text-sm text-foreground">
                  <strong>{countOf(layout.students.length)}</strong> na planilha
                  {layout.courseCode && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {layout.courseCode}
                      {layout.classCode && `, turma ${layout.classCode}`}
                      {layout.period && `, ${layout.period}`}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {" "}
                    · {plan.gradedStudents} com nota para preencher
                  </span>
                </p>

                <div>
                  <span className={LABEL_CLASS}>Avaliações da planilha</span>
                  <ul className="flex flex-wrap gap-1.5">
                    {layout.columns.map((column) => {
                      const assessment = assessments.find(
                        (a) =>
                          a.category !== "extra" &&
                          a.code.toLowerCase() === column.code.toLowerCase(),
                      );
                      return (
                        <li
                          key={column.col}
                          className={`rounded-md border px-2 py-1 font-mono text-xs ${
                            assessment
                              ? "border-primary/40 text-primary"
                              : "border-amber-500/50 text-amber-800 dark:text-amber-200"
                          }`}
                        >
                          {column.code}
                          <span className="ml-1.5 font-sans text-[0.65rem] text-muted-foreground">
                            {assessment
                              ? `vale ${formatPoints(assessment.weight)}`
                              : "não existe aqui"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {layout.period && layout.period !== offerPeriod && (
                  <WarningNote>
                    A planilha é de {layout.period}, mas a oferta aberta é{" "}
                    {offerPeriod}. Confira antes de baixar.
                  </WarningNote>
                )}
                {plan.unknownCodes.length > 0 && (
                  <WarningNote>
                    Sem avaliação regular com o mesmo código no Kuara:{" "}
                    <strong>{plan.unknownCodes.join(", ")}</strong>. Essas
                    colunas ficam como estão na planilha.
                  </WarningNote>
                )}
                {plan.missingCodes.length > 0 && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Só vai para a planilha o que o SIGAA tem. Ficam de fora as
                    avaliações que existem apenas aqui:{" "}
                    <span className="font-mono text-foreground">
                      {plan.missingCodes.join(", ")}
                    </span>
                    .
                  </p>
                )}
                {plan.unknownStudents.length > 0 && (
                  <WarningNote>
                    {plan.unknownStudents.length} matrícula(s) da planilha não
                    estão nesta oferta e ficam sem alteração:{" "}
                    <span className="font-mono">
                      {plan.unknownStudents.join(", ")}
                    </span>
                    .
                  </WarningNote>
                )}

                {hasExtras && (
                  <fieldset className="space-y-2">
                    <legend className={LABEL_CLASS}>Pontos extras</legend>
                    {[
                      {
                        value: false,
                        title: "Sem os pontos extras",
                        text: "Só as notas das avaliações regulares, como foram lançadas.",
                      },
                      {
                        value: true,
                        title: "Com os pontos extras incorporados",
                        text: "Os pontos extras de cada discente são somados às notas regulares que ele já tem, sem passar da nota máxima de cada avaliação.",
                      },
                    ].map((choice) => (
                      <label
                        key={String(choice.value)}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                          withExtras === choice.value
                            ? "border-primary/50 bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="sigaa-extras"
                          checked={withExtras === choice.value}
                          onChange={() => {
                            setDone(null);
                            setWithExtras(choice.value);
                          }}
                          disabled={busy !== null}
                          className="mt-1 accent-[hsl(var(--primary))]"
                        />
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {choice.title}
                          </span>
                          <span className="block text-xs leading-relaxed text-muted-foreground">
                            {choice.text}
                          </span>
                        </span>
                      </label>
                    ))}
                    {withExtras && plan.overflow.length > 0 && (
                      <WarningNote>
                        Para {countOf(plan.overflow.length)}, parte dos pontos
                        extras não coube nas notas regulares e fica de fora:{" "}
                        {plan.overflow
                          .map(
                            (o) => `${o.name} (${formatPoints(o.lostPoints)})`,
                          )
                          .join("; ")}
                        .
                      </WarningNote>
                    )}
                  </fieldset>
                )}
              </div>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}
            {done && <SuccessNote>{done}</SuccessNote>}

            {layout && plan && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null || plan.matchedCodes.length === 0}
                  onClick={download}
                >
                  {busy === "writing" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                  Baixar planilha preenchida
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
