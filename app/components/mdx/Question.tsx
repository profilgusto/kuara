"use client";
import { ReactNode, useState, Children, isValidElement } from "react";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
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

const typeConfig: Record<
  QuestionType,
  { label: string; answerLabel: string; hideAnswerLabel: string }
> = {
  example: {
    label: "Exemplo",
    answerLabel: "Ver solução",
    hideAnswerLabel: "Ocultar solução",
  },
  exercise: {
    label: "Exercício",
    answerLabel: "Ver resposta",
    hideAnswerLabel: "Ocultar resposta",
  },
  problem: {
    label: "Problema",
    answerLabel: "Ver solução",
    hideAnswerLabel: "Ocultar solução",
  },
  definition: {
    label: "Definição",
    answerLabel: "Ver detalhes",
    hideAnswerLabel: "Ocultar detalhes",
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

/**
 * Marks the answer/solution section inside <Question>.
 * Its children are extracted and rendered by the parent Question component.
 * When used outside a Question (e.g., in a test), it renders its children as-is.
 */
export function Answer({ children }: AnswerProps) {
  return <>{children}</>;
}

/**
 * Marks an optional hint section inside <Question>.
 * Rendered between the body and the answer, always starts collapsed.
 * Its children are extracted and rendered by the parent Question component.
 */
export function Hint({ children }: HintProps) {
  return <>{children}</>;
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
 * - `<Hint>` and `<Answer>` are optional and always start collapsed.
 */
export default function Question({
  title,
  type = "exercise",
  initialState = "contracted",
  children,
}: QuestionProps) {
  const number = useQuestionNumber(type);
  const [hintExpanded, setHintExpanded] = useState(false);
  const [answerExpanded, setAnswerExpanded] = useState(
    initialState === "expanded",
  );

  const config = typeConfig[type] ?? typeConfig.exercise;

  // ── Separate <Hint> and <Answer> from body content ──────────────────────────
  const bodyChildren: ReactNode[] = [];
  let hintContent: ReactNode = null;
  let answerContent: ReactNode = null;

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === Hint) {
      hintContent = (child.props as HintProps).children;
    } else if (isValidElement(child) && child.type === Answer) {
      answerContent = (child.props as AnswerProps).children;
    } else {
      bodyChildren.push(child);
    }
  });

  // ── Header label: "Exemplo 3 · Título" ──────────────────────────────────────
  const typeLabel = `${config.label} ${number}`;

  return (
    <div className="my-6 rounded-lg border border-border bg-muted/20 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

      {/* ── Body ── */}
      <div className="px-4 py-3 text-sm [&>p]:my-1.5 [&_strong]:text-inherit [&_em]:text-inherit">
        {bodyChildren}
      </div>

      {/* ── Hint section ── */}
      {hintContent !== null && (
        <div className="border-t border-border/50">
          <button
            onClick={() => setHintExpanded((prev) => !prev)}
            className="w-full flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Lightbulb className="h-3.5 w-3.5 flex-shrink-0" />
            {hintExpanded ? "Ocultar dica" : "Ver dica"}
            <span className="ml-auto">
              {hintExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              hintExpanded
                ? "max-h-[9999px] opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-4 py-3 border-t border-border/50 bg-muted/10 text-sm [&>p]:my-1.5 [&_strong]:text-inherit [&_em]:text-inherit">
              {hintContent}
            </div>
          </div>
        </div>
      )}

      {/* ── Answer section ── */}
      {answerContent !== null && (
        <div className="border-t border-border/50">
          <button
            onClick={() => setAnswerExpanded((prev) => !prev)}
            className="w-full flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            {answerExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            {answerExpanded ? config.hideAnswerLabel : config.answerLabel}
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              answerExpanded
                ? "max-h-[9999px] opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-4 py-3 border-t border-border/50 bg-muted/10 text-sm [&>p]:my-1.5 [&_strong]:text-inherit [&_em]:text-inherit">
              {answerContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
