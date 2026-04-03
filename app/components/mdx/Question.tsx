"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { ChevronDown, ChevronRight, Lightbulb, BookOpen } from "lucide-react";
import { useQuestionNumber } from "./QuestionCounterContext";

export type QuestionType = "example" | "exercise" | "problem" | "definition";

interface QuestionProps {
  title?: string;
  type?: QuestionType;
  /** Controls whether the answer section starts visible. Defaults to "contracted". */
  initialState?: "expanded" | "contracted";
  children: ReactNode;
}

interface AnswerProps {
  children: ReactNode;
}

interface HintProps {
  children: ReactNode;
}

// ─── Per-type styling ─────────────────────────────────────────────────────────

const typeConfig = {
  exercise: {
    label: "Exercício",
    answerLabel: "Ver resposta",
    hideAnswerLabel: "Ocultar resposta",
    borderColor: "border-primary/40",
    bgColor: "bg-primary/5",
    headerBg: "bg-primary/10",
    labelColor: "text-primary",
  },
  example: {
    label: "Exemplo",
    answerLabel: "Ver solução",
    hideAnswerLabel: "Ocultar solução",
    borderColor: "border-secondary/40",
    bgColor: "bg-secondary/5",
    headerBg: "bg-secondary/10",
    labelColor: "text-secondary",
  },
  problem: {
    label: "Problema",
    answerLabel: "Ver solução",
    hideAnswerLabel: "Ocultar solução",
    borderColor: "border-clay/40",
    bgColor: "bg-clay/5",
    headerBg: "bg-clay/10",
    labelColor: "text-clay",
  },
  definition: {
    label: "Definição",
    answerLabel: "Ver detalhes",
    hideAnswerLabel: "Ocultar detalhes",
    borderColor: "border-accent/40",
    bgColor: "bg-accent/5",
    headerBg: "bg-accent/10",
    labelColor: "text-accent",
  },
} satisfies Record<
  QuestionType,
  {
    label: string;
    answerLabel: string;
    hideAnswerLabel: string;
    borderColor: string;
    bgColor: string;
    headerBg: string;
    labelColor: string;
  }
>;

// ─── Context ─────────────────────────────────────────────────────────────────

/**
 * Carries styling and initialState so Hint/Answer components can render
 * themselves without requiring children inspection by the parent.
 * This sidesteps the RSC client-reference serialisation issue where
 * child.type comparisons are unreliable in next-mdx-remote/rsc pipelines.
 */
interface QuestionContextValue {
  borderColor: string;
  initialAnswerState: "expanded" | "contracted";
  answerLabel: string;
  hideAnswerLabel: string;
}

const QuestionContext = createContext<QuestionContextValue | null>(null);

// ─── Sub-components ────────────────────────────────────────────────────────────

/**
 * Optional hint section inside <Question>.
 * Reads styling from QuestionContext and always starts collapsed.
 * Renders as a full-width collapsible section at the bottom of the card.
 */
export function Hint({ children }: HintProps) {
  const ctx = useContext(QuestionContext);
  const [expanded, setExpanded] = useState(false);
  const borderColor = ctx?.borderColor ?? "border-border/50";

  return (
    <div className={`-mx-4 border-t ${borderColor} last:-mb-3`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <Lightbulb className="h-3.5 w-3.5 flex-shrink-0" />
        {expanded ? "Ocultar dica" : "Ver dica"}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className={`px-4 py-3 border-t ${borderColor} bg-muted/10 text-sm [&>p]:my-1.5 [&_strong]:text-inherit [&_em]:text-inherit`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Answer/solution section inside <Question>.
 * Initial visibility is inherited from the parent Question's `initialState` prop
 * via context — no prop drilling or children inspection required.
 */
export function Answer({ children }: AnswerProps) {
  const ctx = useContext(QuestionContext);
  const [expanded, setExpanded] = useState(
    () => ctx?.initialAnswerState === "expanded",
  );
  const borderColor = ctx?.borderColor ?? "border-border/50";
  const answerLabel = ctx?.answerLabel ?? "Ver resposta";
  const hideAnswerLabel = ctx?.hideAnswerLabel ?? "Ocultar resposta";

  return (
    <div className={`-mx-4 border-t ${borderColor} last:-mb-3`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
        {expanded ? hideAnswerLabel : answerLabel}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className={`px-4 py-3 border-t ${borderColor} bg-muted/10 text-sm [&>p]:my-1.5 [&_strong]:text-inherit [&_em]:text-inherit`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

/**
 * Question block for exercises, examples, problems, and definitions.
 * Supports automatic sequential numbering per type within the page.
 *
 * Usage:
 * ```mdx
 * <Question title="Título" type="exercise" initialState="contracted">
 *   Enunciado com **markdown**, $equações$, figuras, etc.
 *   <Hint>
 *     Uma dica para ajudar.
 *   </Hint>
 *   <Answer>
 *     Resposta ou solução detalhada.
 *   </Answer>
 * </Question>
 * ```
 *
 * - `type`: "example" | "exercise" | "problem" | "definition" (default: "exercise")
 * - `initialState`: "expanded" | "contracted" — initial visibility of the answer (default: "contracted")
 * - `<Hint>` always starts collapsed; `<Answer>` respects `initialState`.
 */
export default function Question({
  title,
  type = "exercise",
  initialState = "contracted",
  children,
}: QuestionProps) {
  const number = useQuestionNumber(type);
  const config = typeConfig[type] ?? typeConfig.exercise;
  const typeLabel = `${config.label} ${number}`;

  return (
    <QuestionContext.Provider
      value={{
        borderColor: config.borderColor,
        initialAnswerState: initialState,
        answerLabel: config.answerLabel,
        hideAnswerLabel: config.hideAnswerLabel,
      }}
    >
      <div
        className={`my-6 rounded-lg border ${config.borderColor} ${config.bgColor} overflow-hidden`}
      >
        {/* ── Header ── */}
        <div
          className={`px-4 py-2.5 ${config.headerBg} border-b ${config.borderColor}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${config.labelColor}`}
            >
              {typeLabel}
            </span>
            {title && (
              <>
                <span className="text-muted-foreground/40 select-none">·</span>
                <span className="text-sm font-medium text-foreground/80">
                  {title}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Body ──
            Children render directly here. <Hint> and <Answer> inside will
            render as full-width collapsible sections using -mx-4 to break
            out of the horizontal padding. No children inspection needed. */}
        <div className="px-4 py-3 text-sm [&>p]:my-1.5 [&_strong]:text-inherit [&_em]:text-inherit">
          {children}
        </div>
      </div>
    </QuestionContext.Provider>
  );
}
