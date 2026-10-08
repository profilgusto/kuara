/**
 * lib/grades.ts — reading and showing the grades of an offer.
 *
 * A grade is stored as the percentage (0–100) a student obtained in an
 * assessment; the points it is worth follow from the assessment's weight.
 *
 * Pure: shared by the students table, where grades are shown and typed in,
 * and by the endpoint that saves them (collections/Scores.ts).
 */
import {
  PASSING_GRADE,
  SEMESTER_POINTS,
  type AssessmentRow,
} from "./assessment";
import type { EnrollmentRow } from "./enrollment";

type Id = string | number;

/**
 * What it takes to work out a grade: the assessment's id and, for a
 * checklist, its mode and tasks. Callers with only an id get the plain,
 * one-mark-per-student reading.
 */
export type GradedAssessment = Pick<AssessmentRow, "id"> &
  Partial<Pick<AssessmentRow, "mode" | "tasks">>;

export interface ScoreRow {
  id: Id;
  assessmentId: Id;
  /** The enrolled student the grade belongs to. */
  enrollmentId?: Id | null;
  /**
   * For a checklist assessment: ids of the tasks the student has done. The
   * grade is then worked out from these, and `percentage` is not used.
   */
  completedTaskIds?: string[];
  percentage: number;
}

/** Points obtained, or the percentage of the assessment they amount to. */
export const GRADE_DISPLAYS = ["points", "percent"] as const;
export type GradeDisplay = (typeof GRADE_DISPLAYS)[number];

const same = (a: Id | null | undefined, b: Id | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined
    ? String(a) === String(b)
    : false;

/**
 * The percentage a student got in an assessment, or null when there is no
 * grade yet.
 *
 * A grade always belongs to the student, also in an assessment graded per
 * group: grading a group writes the same grade to each of its members at
 * that moment. So a student who changes group later keeps what they earned,
 * and one who joins after the fact has no grade until given one.
 */
export function percentageFor(
  student: Pick<EnrollmentRow, "id">,
  assessment: GradedAssessment,
  scores: ScoreRow[],
): number | null {
  const score = scores.find(
    (s) =>
      same(s.assessmentId, assessment.id) && same(s.enrollmentId, student.id),
  );
  if (assessment.mode === "checklist") {
    // The share of the tasks done. Every student has one as soon as there
    // are tasks: none done is a zero, not a missing grade.
    const tasks = assessment.tasks ?? [];
    if (tasks.length === 0) return null;
    const done = new Set(score?.completedTaskIds ?? []);
    return (
      (tasks.filter((task) => done.has(task.id)).length / tasks.length) * 100
    );
  }
  return score ? score.percentage : null;
}

/** The tasks of a checklist assessment a student has done, as a set of ids. */
export function completedTasksFor(
  student: Pick<EnrollmentRow, "id">,
  assessment: Pick<AssessmentRow, "id">,
  scores: ScoreRow[],
): Set<string> {
  const score = scores.find(
    (s) =>
      same(s.assessmentId, assessment.id) && same(s.enrollmentId, student.id),
  );
  return new Set(score?.completedTaskIds ?? []);
}

/**
 * Whether a group has done a task: every member, none, or only some —
 * for the checkbox on the group's own row.
 */
export function groupTaskState(
  members: Pick<EnrollmentRow, "id">[],
  assessment: Pick<AssessmentRow, "id">,
  taskId: string,
  scores: ScoreRow[],
): "all" | "none" | "some" {
  if (members.length === 0) return "none";
  const done = members.filter((m) =>
    completedTasksFor(m, assessment, scores).has(taskId),
  ).length;
  return done === 0 ? "none" : done === members.length ? "all" : "some";
}

/** Points for a percentage of an assessment worth `weight`. */
export function pointsFor(percentage: number, weight: number): number {
  return (percentage / 100) * weight;
}

/**
 * A grade as the table shows it: "2.2" in points (one decimal, as SIGAA
 * records them) or "87%" as a share of the assessment. "—" for no grade.
 */
export function formatGrade(
  percentage: number | null,
  weight: number,
  display: GradeDisplay,
): string {
  if (percentage === null) return "—";
  if (display === "percent") {
    // Whole percentages stay whole; anything finer shows one decimal.
    const rounded = Math.round(percentage * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
  }
  return (Math.round(pointsFor(percentage, weight) * 10) / 10).toFixed(1);
}

/** Share of the points on offer that it takes to pass: 6.0 out of 10.0. */
export const PASSING_PERCENTAGE = (PASSING_GRADE / SEMESTER_POINTS) * 100;

/** Whether a grade is at or above the passing share, or below it. */
export type GradeTone = "pass" | "fail";

/** Tolerance for sums of fractional points: 59.999999 is 60. */
const EPSILON = 1e-9;

/** The colour of one grade, judged against its own assessment. */
export function gradeTone(percentage: number | null): GradeTone | null {
  if (percentage === null) return null;
  return percentage >= PASSING_PERCENTAGE - EPSILON ? "pass" : "fail";
}

export interface StudentTotal {
  /** Points obtained so far, bonus points included. */
  points: number;
  /**
   * Points already handed out to this student: the weights of the regular
   * assessments they have a grade in. Bonus assessments add to `points`
   * but not here — they are on top of the semester's points.
   */
  distributed: number;
  /** `points` as a percentage of `distributed`; null while that is zero. */
  percentage: number | null;
  /** The student has at least one grade. */
  graded: boolean;
}

/**
 * A student's running total. It is a partial result, measured against the
 * points handed out so far, and becomes the final one once every assessment
 * has been graded.
 */
export function totalFor(
  student: Pick<EnrollmentRow, "id">,
  assessments: (GradedAssessment &
    Pick<AssessmentRow, "weight" | "category">)[],
  scores: ScoreRow[],
): StudentTotal {
  let points = 0;
  let distributed = 0;
  let graded = false;
  for (const assessment of assessments) {
    const percentage = percentageFor(student, assessment, scores);
    if (percentage === null) continue;
    graded = true;
    points += pointsFor(percentage, assessment.weight);
    if (assessment.category !== "extra") distributed += assessment.weight;
  }
  return {
    points,
    distributed,
    percentage: distributed > 0 ? (points / distributed) * 100 : null,
    graded,
  };
}

/**
 * The colour of a total: passing when it reaches 60% of the points handed
 * out so far. No colour without a grade, or with bonus points only (nothing
 * to measure them against yet).
 */
export function totalTone(total: StudentTotal): GradeTone | null {
  return total.graded ? gradeTone(total.percentage) : null;
}

/** A total as the table shows it, in the same two modes as a grade. */
export function formatTotal(
  total: StudentTotal,
  display: GradeDisplay,
): string {
  if (!total.graded) return "—";
  if (display === "percent") {
    if (total.percentage === null) return "—";
    const rounded = Math.round(total.percentage * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
  }
  return (Math.round(total.points * 10) / 10).toFixed(1);
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** What the cell's input starts with: the grade as shown, without the "%". */
export function gradeInputValue(
  percentage: number | null,
  weight: number,
  display: GradeDisplay,
): string {
  if (percentage === null) return "";
  if (display === "percent") return String(round1(percentage));
  return round1(pointsFor(percentage, weight)).toFixed(1);
}

export type GradeInput =
  /** `percentage: null` means "clear this grade". */
  { ok: true; percentage: number | null } | { ok: false; error: string };

/**
 * A grade as typed into a cell, in the unit on screen: a percentage of the
 * assessment (0–100) or points (0 up to its weight). Dot or comma; blank
 * clears the grade. Always returns the percentage, which is what is stored.
 */
export function parseGradeInput(
  text: string,
  weight: number,
  display: GradeDisplay,
): GradeInput {
  const trimmed = text.trim().replace(/%$/, "").trim();
  if (trimmed === "") return { ok: true, percentage: null };
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: "Digite um número (use ponto ou vírgula)." };
  }
  const value = Number(trimmed.replace(",", "."));

  if (display === "percent") {
    if (value > 100) {
      return { ok: false, error: "A porcentagem vai de 0 a 100." };
    }
    return { ok: true, percentage: value };
  }
  if (value > weight + EPSILON) {
    return {
      ok: false,
      error: `Esta avaliação vale no máximo ${weight.toFixed(1)}.`,
    };
  }
  // Stored with enough precision to give the typed points back exactly.
  return {
    ok: true,
    percentage: Math.round((value / weight) * 100 * 10000) / 10000,
  };
}

/** The grade of a group as a whole, for the cell on the group's own row. */
export type GroupGrade =
  | { kind: "none" }
  | { kind: "same"; percentage: number }
  /** Members hold different grades (or only some hold one). */
  | { kind: "mixed" };

export function groupPercentage(
  members: Pick<EnrollmentRow, "id">[],
  assessment: GradedAssessment,
  scores: ScoreRow[],
): GroupGrade {
  const grades = members.map((m) => percentageFor(m, assessment, scores));
  const given = grades.filter((g): g is number => g !== null);
  if (given.length === 0) return { kind: "none" };
  const allSame =
    given.length === grades.length &&
    given.every((g) => Math.abs(g - given[0]) < EPSILON);
  return allSame ? { kind: "same", percentage: given[0] } : { kind: "mixed" };
}

/**
 * The cell Tab moves to. `columns` holds, per assessment, the ids of its
 * editable cells from top to bottom. Tab goes down the same column — the
 * next student in the same assessment — and from the last row to the top of
 * the next column; Shift+Tab does the reverse. Null past either end.
 */
export function nextGradeCell(
  columns: string[][],
  current: string,
  direction: 1 | -1,
): string | null {
  const order = columns.flat();
  const index = order.indexOf(current);
  if (index === -1) return null;
  return order[index + direction] ?? null;
}

export const MAX_SCORES_PER_REQUEST = 200;

export type SetScoresRequest =
  | {
      ok: true;
      offer: Id;
      activity: Id;
      enrollments: Id[];
      percentage: number | null;
    }
  | { ok: false; error: string };

const isId = (value: unknown): value is Id =>
  (typeof value === "number" && Number.isInteger(value)) ||
  (typeof value === "string" && value.trim() !== "");

/** Checks the body of POST /api/scores/set. */
export function validateSetScores(input: unknown): SetScoresRequest {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const raw = input as Record<string, unknown>;

  if (!isId(raw.offer)) return { ok: false, error: "Oferta não informada." };
  if (!isId(raw.activity)) {
    return { ok: false, error: "Avaliação não informada." };
  }
  if (
    !Array.isArray(raw.enrollments) ||
    raw.enrollments.length === 0 ||
    !raw.enrollments.every(isId)
  ) {
    return { ok: false, error: "Nenhum discente informado." };
  }
  if (raw.enrollments.length > MAX_SCORES_PER_REQUEST) {
    return { ok: false, error: "Discentes demais em um único lançamento." };
  }

  const percentage = raw.percentage;
  if (
    percentage !== null &&
    !(
      typeof percentage === "number" &&
      Number.isFinite(percentage) &&
      percentage >= 0 &&
      percentage <= 100
    )
  ) {
    return { ok: false, error: "A nota deve ser uma porcentagem de 0 a 100." };
  }

  // The same student listed twice counts once.
  const enrollments = [
    ...new Map(raw.enrollments.map((id) => [String(id), id])).values(),
  ];
  return {
    ok: true,
    offer: raw.offer,
    activity: raw.activity,
    enrollments,
    percentage,
  };
}

export type SetTaskRequest =
  | {
      ok: true;
      offer: Id;
      activity: Id;
      task: string;
      enrollments: Id[];
      done: boolean;
    }
  | { ok: false; error: string };

/** Checks the body of POST /api/scores/tasks. */
export function validateSetTask(input: unknown): SetTaskRequest {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const raw = input as Record<string, unknown>;

  if (!isId(raw.offer)) return { ok: false, error: "Oferta não informada." };
  if (!isId(raw.activity)) {
    return { ok: false, error: "Avaliação não informada." };
  }
  if (typeof raw.task !== "string" || raw.task.trim() === "") {
    return { ok: false, error: "Tarefa não informada." };
  }
  if (
    !Array.isArray(raw.enrollments) ||
    raw.enrollments.length === 0 ||
    !raw.enrollments.every(isId)
  ) {
    return { ok: false, error: "Nenhum discente informado." };
  }
  if (raw.enrollments.length > MAX_SCORES_PER_REQUEST) {
    return { ok: false, error: "Discentes demais em um único lançamento." };
  }
  if (typeof raw.done !== "boolean") {
    return { ok: false, error: "Informe se a tarefa foi feita ou não." };
  }

  return {
    ok: true,
    offer: raw.offer,
    activity: raw.activity,
    task: raw.task,
    enrollments: [
      ...new Map(raw.enrollments.map((id) => [String(id), id])).values(),
    ],
    done: raw.done,
  };
}

/** A student's done tasks after marking or unmarking one of them. */
export function toggleTask(
  completed: Iterable<string>,
  taskId: string,
  done: boolean,
): string[] {
  const next = new Set(completed);
  if (done) next.add(taskId);
  else next.delete(taskId);
  return [...next];
}
