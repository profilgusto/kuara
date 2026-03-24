"use client";
import { createContext, useContext, useRef, type ReactNode } from "react";
import type { QuestionType } from "./Question";

type CounterMap = Partial<Record<QuestionType, number>>;

/**
 * Holds a mutable ref to per-type counters.
 * Using a ref (not state) means increments are synchronous and cause no re-renders.
 */
const QuestionCounterContext =
  createContext<React.MutableRefObject<CounterMap> | null>(null);

/**
 * Wraps MDX content to enable automatic per-type numbering of Question blocks.
 * Place this around any rendered MDX output (e.g., in ModulePageClient).
 */
export function QuestionCounterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const countersRef = useRef<CounterMap>({});
  return (
    <QuestionCounterContext.Provider value={countersRef}>
      {children}
    </QuestionCounterContext.Provider>
  );
}

/**
 * Returns the sequential number for a Question of the given type within the
 * nearest QuestionCounterProvider. Each call during the first render of a
 * Question instance claims the next number; subsequent renders of the same
 * instance reuse the claimed number via an internal ref.
 *
 * Falls back to 1 if no provider is present.
 */
export function useQuestionNumber(type: QuestionType): number {
  const countersRef = useContext(QuestionCounterContext);
  // assignedRef persists across re-renders of the same component instance.
  const assignedRef = useRef<number | null>(null);

  if (assignedRef.current === null) {
    if (countersRef) {
      const prev = countersRef.current[type] ?? 0;
      countersRef.current[type] = prev + 1;
      assignedRef.current = prev + 1;
    } else {
      assignedRef.current = 1;
    }
  }

  return assignedRef.current;
}
