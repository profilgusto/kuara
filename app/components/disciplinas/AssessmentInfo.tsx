import {
  categoryLabel,
  formatDueDate,
  formatPoints,
  modeLabel,
  questionsOf,
  scoringUnitLabel,
  type AssessmentRow,
} from "@/lib/assessment";

/**
 * What a column heading of the students table abbreviates, in full: the
 * assessment's name and how it counts. On a screen with a mouse this is the
 * hover balloon; on a touch screen it is what a tap on the heading opens,
 * and what the legend lists.
 */
export function AssessmentInfo({
  assessment,
  compact = false,
}: {
  assessment: AssessmentRow;
  /** One short block per assessment, for the legend. */
  compact?: boolean;
}) {
  const due = formatDueDate(assessment.dueDate);
  const count =
    assessment.mode === "checklist"
      ? ` · ${assessment.tasks.length} tarefa(s)`
      : assessment.mode === "questions"
        ? ` · ${questionsOf(assessment).length} questão(ões)`
        : "";
  return (
    <div className="space-y-1.5 text-left text-xs font-normal normal-case tracking-normal">
      <p className="text-sm font-semibold leading-snug text-foreground">
        <span
          className={`mr-1.5 font-mono ${
            assessment.category === "extra" ? "text-secondary" : "text-primary"
          }`}
        >
          {assessment.code}
        </span>
        {assessment.name}
      </p>
      <p className="text-muted-foreground">
        Vale{" "}
        <strong className="font-mono text-foreground">
          {formatPoints(assessment.weight)}
        </strong>{" "}
        · {categoryLabel(assessment.category)} ·{" "}
        {scoringUnitLabel(assessment.scoredBy)}
        {!compact && (
          <>
            {" "}
            · {modeLabel(assessment.mode)}
            {count}
          </>
        )}
      </p>
      {due && (
        <p className="text-muted-foreground">
          Entrega <span className="font-mono text-foreground">{due}</span>
        </p>
      )}
      {!compact && assessment.comment && (
        <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
          {assessment.comment}
        </p>
      )}
    </div>
  );
}
