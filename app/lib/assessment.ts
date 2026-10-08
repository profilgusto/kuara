/**
 * lib/assessment.ts — the assessments ("avaliações") of an offer: parsing
 * and validating what is typed into the table, and adding up the points.
 *
 * At UFSJ a semester is worth 10.0 points, recorded with one decimal place,
 * and passing takes 6.0. Regular assessments are the ones that add up to
 * those 10.0; extra ones are bonus points on top.
 *
 * Sums are done in tenths of a point, as integers: 0.1 + 0.2 must be 0.3.
 */

export const SEMESTER_POINTS = 10;
export const PASSING_GRADE = 6;

export const ASSESSMENT_CATEGORIES = ["regular", "extra"] as const;
export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];

/** Who gets the grade: each student, or each work group as a whole. */
export const SCORING_UNITS = ["student", "group"] as const;
export type ScoringUnit = (typeof SCORING_UNITS)[number];

/**
 * How an assessment is graded. "graded": one mark per student, a percentage
 * of its points. "checklist": several small tasks, each either done or not;
 * the student earns the share of the tasks they did.
 */
export const ASSESSMENT_MODES = ["graded", "checklist"] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

/** One task of a checklist assessment. */
export interface AssessmentTask {
  id: string;
  /** Short acronym for column headings; absent when none was given. */
  code?: string;
  /** The descriptive name, shown on hover and in the tasks panel. */
  name: string;
}

export const MAX_TASK_NAME_LENGTH = 80;
export const MAX_TASKS = 60;

export const MAX_ASSESSMENT_CODE_LENGTH = 8;
export const MAX_ASSESSMENT_NAME_LENGTH = 120;

export interface AssessmentRow {
  id: string | number;
  code: string;
  name: string;
  weight: number;
  category: AssessmentCategory;
  scoredBy: ScoringUnit;
  mode: AssessmentMode;
  /** The tasks of a checklist assessment; empty for a graded one. */
  tasks: AssessmentTask[];
  /** Day the work is due, "YYYY-MM-DD"; "" or absent when not set. */
  dueDate?: string;
  /** Free notes about the assessment; "" or absent when none. */
  comment?: string;
}

/** What the inline "new assessment" row holds while being typed. Text. */
export interface AssessmentDraft {
  code: string;
  name: string;
  weight: string;
  category: AssessmentCategory;
  scoredBy: ScoringUnit;
  mode: AssessmentMode;
  dueDate: string;
  comment: string;
}

export const EMPTY_ASSESSMENT_DRAFT: AssessmentDraft = {
  code: "",
  name: "",
  weight: "",
  category: "regular",
  scoredBy: "student",
  mode: "graded",
  dueDate: "",
  comment: "",
};

export function parseAssessmentCategory(value: unknown): AssessmentCategory {
  return value === "extra" ? "extra" : "regular";
}

export function categoryLabel(category: AssessmentCategory): string {
  return category === "extra" ? "Extra" : "Regular";
}

export function parseAssessmentMode(value: unknown): AssessmentMode {
  return value === "checklist" ? "checklist" : "graded";
}

export function modeLabel(mode: AssessmentMode): string {
  return mode === "checklist" ? "Tarefas" : "Nota";
}

/** The tasks of an activity as Payload returns them, tidied. */
export function parseTasks(value: unknown): AssessmentTask[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const task = (item ?? {}) as {
      id?: unknown;
      code?: unknown;
      name?: unknown;
    };
    const id =
      typeof task.id === "string" || typeof task.id === "number"
        ? String(task.id)
        : "";
    const name = typeof task.name === "string" ? task.name.trim() : "";
    const code =
      typeof task.code === "string" ? sanitizeCodeInput(task.code) : "";
    return id && name ? [code ? { id, code, name } : { id, name }] : [];
  });
}

/** A task as typed in the tasks panel; no id means a new one. */
export interface TaskDraft {
  id?: string;
  code?: string;
  name: string;
}

export type TaskListResult =
  | { ok: true; tasks: TaskDraft[] }
  | { ok: false; error: string };

/**
 * Checks the task list typed in the tasks panel: every task named, no two
 * with the same name (they are told apart by it on screen), not too many.
 * A task without an id is a new one.
 */
export function validateTaskList(tasks: TaskDraft[]): TaskListResult {
  if (tasks.length > MAX_TASKS) {
    return { ok: false, error: `Use no máximo ${MAX_TASKS} tarefas.` };
  }
  const seen = new Set<string>();
  const seenCodes = new Set<string>();
  const clean: TaskDraft[] = [];
  for (const task of tasks) {
    const name = task.name.trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, error: "Dê um nome a cada tarefa." };
    if (name.length > MAX_TASK_NAME_LENGTH) {
      return {
        ok: false,
        error: `O nome “${name.slice(0, 20)}…” é longo demais.`,
      };
    }
    const key = name.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) {
      return { ok: false, error: `Há duas tarefas chamadas “${name}”.` };
    }
    seen.add(key);
    const code = sanitizeCodeInput(task.code ?? "");
    if (code) {
      if (seenCodes.has(code)) {
        return { ok: false, error: `Há duas tarefas com o acrônimo ${code}.` };
      }
      seenCodes.add(code);
    }
    clean.push({
      ...(task.id ? { id: task.id } : {}),
      ...(code ? { code } : {}),
      name,
    });
  }
  return { ok: true, tasks: clean };
}

export function parseScoringUnit(value: unknown): ScoringUnit {
  return value === "group" ? "group" : "student";
}

export function scoringUnitLabel(unit: ScoringUnit): string {
  return unit === "group" ? "Grupo" : "Discente";
}

/**
 * The same choice as Payload stores it, in the activity's `type` field
 * ("individual" | "group") — which predates this table.
 */
export function scoringUnitToActivityType(
  unit: ScoringUnit,
): "individual" | "group" {
  return unit === "group" ? "group" : "individual";
}

export function scoringUnitFromActivityType(type: unknown): ScoringUnit {
  return type === "group" ? "group" : "student";
}

const toTenths = (points: number) => Math.round(points * 10);

/** Points the way SIGAA writes them: one decimal, with a dot ("10.0"). */
export function formatPoints(points: number): string {
  return (toTenths(points) / 10).toFixed(1);
}

/**
 * Points as typed: "2", "2.5" or "2,5" — at most one decimal. Returns null
 * for anything else, including values outside 0.1–10.0.
 */
export function parseWeight(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}([.,]\d)?$/.test(trimmed)) return null;
  const tenths = toTenths(Number(trimmed.replace(",", ".")));
  if (tenths < 1 || tenths > SEMESTER_POINTS * 10) return null;
  return tenths / 10;
}

/** What the code box keeps of what was typed: upper case, no spaces. */
export function sanitizeCodeInput(text: string): string {
  return text
    .replace(/\s+/g, "")
    .toLocaleUpperCase("pt-BR")
    .slice(0, MAX_ASSESSMENT_CODE_LENGTH);
}

export const MAX_ASSESSMENT_COMMENT_LENGTH = 500;

/** A real calendar day written "YYYY-MM-DD" (what a date input yields). */
export function isIsoDay(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** "2026-10-08" → "08/10/2026"; anything else → "". */
export function formatDueDate(day: string | undefined): string {
  if (!day || !isIsoDay(day)) return "";
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/**
 * The day out of what Payload stores for a date field (an ISO timestamp).
 * Days are saved at noon UTC (`dueDateToStored`), so the date part is the
 * day in any Brazilian timezone.
 */
export function parseDueDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const day = value.slice(0, 10);
  return isIsoDay(day) ? day : "";
}

/** An `activities` document, as Payload returns it, as a table row. */
export function assessmentFromActivity(doc: {
  id: string | number;
  acronym: string;
  description: string;
  weight: number;
  category?: unknown;
  type?: unknown;
  mode?: unknown;
  tasks?: unknown;
  dueDate?: unknown;
  comment?: string | null;
}): AssessmentRow {
  return {
    id: doc.id,
    code: doc.acronym,
    name: doc.description,
    weight: doc.weight,
    category: parseAssessmentCategory(doc.category),
    scoredBy: scoringUnitFromActivityType(doc.type),
    mode: parseAssessmentMode(doc.mode),
    tasks: parseTasks(doc.tasks),
    dueDate: parseDueDate(doc.dueDate),
    comment: doc.comment ?? "",
  };
}

/** A day as the timestamp sent to Payload, or null to clear it. */
export function dueDateToStored(day: string): string | null {
  return day ? `${day}T12:00:00.000Z` : null;
}

export type AssessmentResult =
  | {
      ok: true;
      assessment: Omit<
        AssessmentRow,
        "id" | "tasks" | "dueDate" | "comment"
      > & {
        dueDate: string;
        comment: string;
      };
    }
  | { ok: false; error: string };

/** Checks the inline row before it is saved. */
export function validateAssessment(
  draft: AssessmentDraft,
  existingCodes: string[] = [],
): AssessmentResult {
  const code = sanitizeCodeInput(draft.code);
  if (!code) return { ok: false, error: "Informe o código da avaliação." };
  if (existingCodes.some((existing) => sanitizeCodeInput(existing) === code)) {
    return {
      ok: false,
      error: `Já existe uma avaliação com o código ${code}.`,
    };
  }

  const name = draft.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Informe o nome da avaliação." };
  if (name.length > MAX_ASSESSMENT_NAME_LENGTH) {
    return { ok: false, error: "O nome é longo demais." };
  }

  const weight = parseWeight(draft.weight);
  if (weight === null) {
    return {
      ok: false,
      error:
        "Informe o peso em pontos, de 0.1 a 10.0, com no máximo uma casa decimal.",
    };
  }

  const dueDate = draft.dueDate.trim();
  if (dueDate && !isIsoDay(dueDate)) {
    return { ok: false, error: "Informe uma data de entrega válida." };
  }

  const comment = draft.comment.trim();
  if (comment.length > MAX_ASSESSMENT_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Use no máximo ${MAX_ASSESSMENT_COMMENT_LENGTH} caracteres no comentário.`,
    };
  }

  return {
    ok: true,
    assessment: {
      code,
      name,
      weight,
      dueDate,
      comment,
      category: parseAssessmentCategory(draft.category),
      scoredBy: parseScoringUnit(draft.scoredBy),
      mode: parseAssessmentMode(draft.mode),
    },
  };
}

export interface AssessmentTotals {
  regular: number;
  extra: number;
  total: number;
  /** The regular assessments add up to exactly the semester's 10.0. */
  regularIsComplete: boolean;
}

export function sumAssessments(
  rows: Pick<AssessmentRow, "weight" | "category">[],
): AssessmentTotals {
  let regular = 0;
  let extra = 0;
  for (const row of rows) {
    if (row.category === "extra") extra += toTenths(row.weight);
    else regular += toTenths(row.weight);
  }
  return {
    regular: regular / 10,
    extra: extra / 10,
    total: (regular + extra) / 10,
    regularIsComplete: regular === SEMESTER_POINTS * 10,
  };
}
