"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Hash,
  Loader2,
  Percent,
  Trash2,
  X,
} from "lucide-react";
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
  MAX_ASSESSMENT_CODE_LENGTH,
  MAX_QUESTION_NAME_LENGTH,
  formatPoints,
  parseQuestionWeight,
  parseQuestions,
  questionsOf,
  sanitizeCodeInput,
  validateQuestionList,
  type AssessmentQuestion,
  type AssessmentRow,
} from "@/lib/assessment";

const FIELD_CLASS =
  "rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [@media(pointer:coarse)]:text-base disabled:opacity-60";

const LABEL_CLASS =
  "mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground";

const ICON_CLASS =
  "inline-flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30";

/** A question as edited here: new ones have no id yet. */
type DraftQuestion = {
  key: string;
  id?: string;
  code: string;
  name: string;
  weight: string;
};

/** What the weight box is written in. */
type WeightUnit = "points" | "percent";

const weightText = (weight: number) =>
  String(Math.round(weight * 100) / 100).replace(".", ",");

/** A share (0–1) of the assessment, written in the unit chosen. */
const shareText = (share: number, unit: WeightUnit, points: number) =>
  weightText(share * (unit === "percent" ? 100 : points));

let nextKey = 0;
const draftOf = (
  question: AssessmentQuestion,
  weight: string,
): DraftQuestion => ({
  key: `saved-${question.id}`,
  id: question.id,
  code: question.code ?? "",
  name: question.name,
  weight,
});

/**
 * The questions of a "questions" assessment: what a student answers one by
 * one, each graded from 0% to 100% in the students table. Here they are
 * named, weighed, reordered, added and removed.
 *
 * A question's weight is relative to the others: the assessment's grade is
 * the average of the marks weighted by them, so the points a question is
 * worth — shown beside it — are its share of the assessment's own points.
 *
 * Nothing is saved until "Salvar questões" — the list goes to Payload whole,
 * keeping the id of each question that survives so that the marks students
 * already have stay attached to it. Leaving with changes not yet saved asks
 * first.
 */
export function AssessmentQuestionsModal({
  assessment,
  open,
  onOpenChange,
  onSaved,
}: {
  assessment: AssessmentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the questions as saved, ids included. */
  onSaved: (questions: AssessmentQuestion[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  // The weights are stored relative to one another; here they are written
  // as points of the assessment or as a percentage of it, whichever is
  // easier, and are shown as the share each question has today.
  const [unit, setUnit] = useState<WeightUnit>("points");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => {
    const list = questionsOf(assessment);
    const total = list.reduce((sum, q) => sum + q.weight, 0);
    return list.map((q) =>
      draftOf(q, shareText(q.weight / total, "points", assessment.weight)),
    );
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);

  const saved = questionsOf(assessment);
  const weights = questions.map((q) => parseQuestionWeight(q.weight) ?? 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const savedTotal = saved.reduce((sum, q) => sum + q.weight, 0);
  // Whether a question keeps the share of the assessment it had when saved
  // (the unit it is written in is not a change).
  const sameShare = (index: number) =>
    parseQuestionWeight(questions[index].weight) !== null &&
    saved[index] !== undefined &&
    Math.abs(weights[index] / totalWeight - saved[index].weight / savedTotal) <
      0.0005;
  const dirty =
    name.trim() !== "" ||
    code.trim() !== "" ||
    questions.length !== saved.length ||
    questions.some((question, index) => {
      const savedQuestion = saved[index];
      return (
        question.id !== savedQuestion?.id ||
        question.code !== (savedQuestion?.code ?? "") ||
        question.name !== savedQuestion?.name ||
        !sameShare(index)
      );
    });

  const removedSaved = saved.filter(
    (question) => !questions.some((q) => q.id === question.id),
  ).length;

  // Points each question is worth now: its share of the assessment's.
  // The same share, in the unit not being typed.
  const otherUnitOf = (index: number) => {
    if (totalWeight <= 0) return "—";
    const share = weights[index] / totalWeight;
    return unit === "points"
      ? `${Math.round(share * 1000) / 10}%`.replace(".", ",")
      : formatPoints(share * assessment.weight);
  };
  const target = unit === "percent" ? 100 : assessment.weight;
  const typedSum =
    Math.round(weights.reduce((sum, w) => sum + w, 0) * 100) / 100;
  const sumsUp = Math.abs(typedSum - target) < 0.051;

  function switchUnit(next: WeightUnit) {
    if (next === unit) return;
    // Convert what is typed into the other unit by each question's share.
    if (
      questions.length > 0 &&
      totalWeight > 0 &&
      weights.every((w) => w > 0)
    ) {
      setQuestions((list) =>
        list.map((q, index) => ({
          ...q,
          weight: shareText(
            weights[index] / totalWeight,
            next,
            assessment.weight,
          ),
        })),
      );
      setWeight("");
    }
    setUnit(next);
  }

  function patch(key: string, change: Partial<DraftQuestion>) {
    setQuestions((list) =>
      list.map((q) => (q.key === key ? { ...q, ...change } : q)),
    );
  }

  function move(index: number, by: -1 | 1) {
    setQuestions((list) => {
      const to = index + by;
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const typed = name.trim().replace(/\s+/g, " ");
    if (!typed) return;
    const checked = validateQuestionList([
      ...questions,
      { code: sanitizeCodeInput(code), name: typed, weight },
    ]);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    setQuestions((list) => [
      ...list,
      {
        key: `new-${nextKey++}`,
        code: sanitizeCodeInput(code),
        name: typed,
        weight,
      },
    ]);
    setName("");
    setCode("");
    setWeight("");
    input.current?.focus();
  }

  async function save() {
    if (busy) return;
    const checked = validateQuestionList(questions);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        comBasePath(`/api/activities/${assessment.id}?depth=0`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ questions: checked.questions }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite alterar as questões. Entre novamente como administrador."
            : "Não foi possível salvar as questões. Tente novamente.",
        );
        return;
      }
      onSaved(parseQuestions(data?.doc?.questions));
      onOpenChange(false);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next && dirty) setConfirmingExit(true);
        else onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 w-screen sm:h-auto sm:max-h-[88dvh] sm:w-[min(40rem,calc(100vw-2rem))] sm:rounded-2xl sm:border"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5 sm:px-8">
          <div className="space-y-1">
            <DialogTitle className="font-serif text-xl tracking-tight">
              Questões de{" "}
              <span className="font-mono text-primary">{assessment.code}</span>
            </DialogTitle>
            <DialogDescription>
              {assessment.name} · vale {formatPoints(assessment.weight)}
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
            Cada questão recebe uma nota de 0% a 100% por discente, na tabela de
            discentes. Diga quanto cada uma vale da avaliação, em pontos ou em
            porcentagem dela; a nota da avaliação é a média das notas ponderada
            por esses valores.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Valor de cada questão em
            </span>
            <div
              role="group"
              aria-label="Unidade do valor"
              className="flex items-center rounded-md border border-border/60 p-0.5"
            >
              <button
                type="button"
                onClick={() => switchUnit("points")}
                disabled={busy}
                aria-pressed={unit === "points"}
                aria-label="Valores em pontos"
                className={`flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 ${
                  unit === "points"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Hash className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => switchUnit("percent")}
                disabled={busy}
                aria-pressed={unit === "percent"}
                aria-label="Valores em porcentagem da avaliação"
                className={`flex h-7 w-7 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 ${
                  unit === "percent"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Percent className="h-4 w-4" />
              </button>
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Nenhuma questão ainda. Sem questões, esta avaliação não gera nota.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 pl-[3.75rem] pr-[4.75rem] font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                <span className="w-20 shrink-0">Acrônimo</span>
                <span className="min-w-0 flex-1">Nome</span>
                <span className="w-16 shrink-0 text-right">
                  {unit === "percent" ? "%" : "Pontos"}
                </span>
                <span className="w-14 shrink-0 text-right">
                  {unit === "percent" ? "Pontos" : "%"}
                </span>
              </div>
              <ol className="space-y-1.5">
                {questions.map((question, index) => (
                  <li key={question.key} className="flex items-center gap-2">
                    <span className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                        aria-label={`Subir questão ${question.name || index + 1}`}
                        className={`${ICON_CLASS} h-3.5 text-muted-foreground/60 hover:text-foreground`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={busy || index === questions.length - 1}
                        aria-label={`Descer questão ${question.name || index + 1}`}
                        className={`${ICON_CLASS} h-3.5 text-muted-foreground/60 hover:text-foreground`}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </span>
                    <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <input
                      aria-label={`Acrônimo da questão ${index + 1}`}
                      placeholder="—"
                      maxLength={MAX_ASSESSMENT_CODE_LENGTH}
                      value={question.code}
                      onChange={(e) =>
                        patch(question.key, {
                          code: sanitizeCodeInput(e.target.value),
                        })
                      }
                      disabled={busy}
                      className={`${FIELD_CLASS} w-20 shrink-0 font-mono`}
                    />
                    <input
                      aria-label={`Nome da questão ${index + 1}`}
                      maxLength={MAX_QUESTION_NAME_LENGTH}
                      value={question.name}
                      onChange={(e) =>
                        patch(question.key, { name: e.target.value })
                      }
                      disabled={busy}
                      className={`${FIELD_CLASS} min-w-0 flex-1`}
                    />
                    <input
                      aria-label={`Valor da questão ${index + 1}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={question.weight}
                      onChange={(e) =>
                        patch(question.key, {
                          weight: e.target.value
                            .replace(/[^\d.,]/g, "")
                            .slice(0, 6),
                        })
                      }
                      disabled={busy}
                      className={`${FIELD_CLASS} w-16 shrink-0 text-right font-mono ${
                        parseQuestionWeight(question.weight) === null
                          ? "border-red-500"
                          : ""
                      }`}
                    />
                    <span
                      data-question-share
                      className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
                    >
                      {otherUnitOf(index)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((list) =>
                          list.filter((q) => q.key !== question.key),
                        )
                      }
                      disabled={busy}
                      aria-label={`Remover questão ${question.name || index + 1}`}
                      className={`${ICON_CLASS} text-red-600/60 hover:bg-red-500/10 hover:text-red-600 focus-visible:ring-red-500/50 dark:text-red-400/60 dark:hover:text-red-400`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}

          <form onSubmit={add} noValidate className="flex items-end gap-2">
            <div className="w-20 shrink-0">
              <label htmlFor="new-question-code" className={LABEL_CLASS}>
                Acrônimo
              </label>
              <input
                id="new-question-code"
                autoComplete="off"
                placeholder="Q1"
                maxLength={MAX_ASSESSMENT_CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(sanitizeCodeInput(e.target.value))}
                readOnly={busy}
                className={`${FIELD_CLASS} w-full font-mono`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="new-question-name" className={LABEL_CLASS}>
                Nova questão
              </label>
              <input
                ref={input}
                id="new-question-name"
                autoComplete="off"
                placeholder="Questão 1"
                maxLength={MAX_QUESTION_NAME_LENGTH}
                value={name}
                onChange={(e) => setName(e.target.value)}
                readOnly={busy}
                className={`${FIELD_CLASS} w-full`}
              />
            </div>
            <div className="w-16 shrink-0">
              <label htmlFor="new-question-weight" className={LABEL_CLASS}>
                {unit === "percent" ? "%" : "Pontos"}
              </label>
              <input
                id="new-question-weight"
                placeholder={unit === "percent" ? "25" : "1,0"}
                inputMode="decimal"
                autoComplete="off"
                value={weight}
                onChange={(e) =>
                  setWeight(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))
                }
                readOnly={busy}
                className={`${FIELD_CLASS} w-full text-right font-mono`}
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={busy}>
              Inserir
            </Button>
          </form>

          {questions.length > 0 && !sumsUp && (
            <p
              role="status"
              data-sum-warning
              className="rounded-md border-l-4 border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
            >
              As questões somam{" "}
              {unit === "percent"
                ? `${weightText(typedSum)}%`
                : formatPoints(typedSum)}
              , e a avaliação vale{" "}
              {unit === "percent" ? "100%" : formatPoints(assessment.weight)}.
              Os valores serão ajustados proporcionalmente.
            </p>
          )}

          {removedSaved > 0 && (
            <p className="rounded-md border-l-4 border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              {removedSaved === 1
                ? "Uma questão já salva será removida"
                : `${removedSaved} questões já salvas serão removidas`}
              : as notas que os discentes têm nela se perdem.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs leading-relaxed text-red-900 dark:text-red-200"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={save}>
            {busy && <Loader2 className="animate-spin" />}
            Salvar questões
          </Button>
        </footer>

        <Dialog open={confirmingExit} onOpenChange={setConfirmingExit}>
          <DialogContent>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              As alterações nas questões de {assessment.code} ainda não foram
              salvas. Se sair agora, elas se perdem.
            </DialogDescription>
            <div className="flex w-full flex-wrap-reverse items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingExit(false);
                  onOpenChange(false);
                }}
                className="rounded-md px-2 py-1 text-xs text-red-600/80 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-300/80 dark:hover:text-red-300"
              >
                Descartar alterações
              </button>
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                onClick={() => setConfirmingExit(false)}
              >
                Continuar editando
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
