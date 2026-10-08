/**
 * lib/course-edit.ts — the pure half of the in-page course editor.
 *
 * Turns what the admin typed into the body of a PATCH to /api/courses/:id,
 * and reads Payload's error replies. Kept out of the component so the
 * validation is unit-testable.
 */

export interface CourseWorkload {
  theoretical?: number | null;
  practical?: number | null;
}

/** The course fields the page lets an admin edit in place. */
export type CourseField = "title" | "code" | "workload" | "summary";

/** What the edit box holds while a field is open. Always text. */
export interface CourseDraft {
  title: string;
  code: string;
  summary: string;
  theoretical: string;
  practical: string;
}

export interface CoursePatch {
  title?: string;
  code?: string;
  summary?: string | null;
  workload?: { theoretical: number | null; practical: number | null };
}

export type PatchResult =
  | { ok: true; patch: CoursePatch }
  | { ok: false; error: string };

/**
 * "30h teórica · 15h prática". Empty when there are no hours to show: a
 * workload of 0 counts as none, so it never renders a stray "0".
 */
export function formatWorkload(
  workload: CourseWorkload | null | undefined,
): string {
  const parts: string[] = [];
  if (workload?.theoretical) parts.push(`${workload.theoretical}h teórica`);
  if (workload?.practical) parts.push(`${workload.practical}h prática`);
  return parts.join(" · ");
}

/** Hours as typed: blank means "none", otherwise a whole number ≥ 0. */
function parseHours(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

/** Validates one field of the draft and builds the PATCH body for it. */
export function buildCoursePatch(
  field: CourseField,
  draft: CourseDraft,
): PatchResult {
  switch (field) {
    case "title": {
      const title = draft.title.trim();
      if (!title) return { ok: false, error: "Informe o nome da disciplina." };
      return { ok: true, patch: { title } };
    }
    case "code": {
      const code = draft.code.trim();
      if (!code) return { ok: false, error: "Informe o código da disciplina." };
      return { ok: true, patch: { code } };
    }
    case "summary": {
      const summary = draft.summary.trim();
      return { ok: true, patch: { summary: summary || null } };
    }
    case "workload": {
      const theoretical = parseHours(draft.theoretical);
      const practical = parseHours(draft.practical);
      if (theoretical === undefined || practical === undefined) {
        return {
          ok: false,
          error: "Informe as horas como números inteiros (ou deixe em branco).",
        };
      }
      return { ok: true, patch: { workload: { theoretical, practical } } };
    }
  }
}

/** The draft that opens the edit box, from the values currently saved. */
export function draftFromCourse(course: {
  title: string;
  code: string;
  summary?: string | null;
  workload?: CourseWorkload | null;
}): CourseDraft {
  return {
    title: course.title,
    code: course.code,
    summary: course.summary ?? "",
    theoretical: course.workload?.theoretical?.toString() ?? "",
    practical: course.workload?.practical?.toString() ?? "",
  };
}

/**
 * A message for a failed save, from the HTTP status and Payload's reply
 * (`{ errors: [{ message, data: { errors: [{ message, path }] } }] }`).
 */
export function saveErrorMessage(status: number, body: unknown): string {
  if (status === 401 || status === 403) {
    return "Sua sessão não permite editar esta disciplina. Entre novamente como administrador.";
  }

  const first = (body as { errors?: unknown[] } | null)?.errors?.[0] as
    | { message?: unknown; data?: { errors?: { path?: unknown }[] } }
    | undefined;
  const paths = first?.data?.errors?.map((e) => e.path) ?? [];
  if (paths.includes("code")) {
    return "Já existe uma disciplina com este código.";
  }
  if (typeof first?.message === "string" && first.message) {
    return `Não foi possível salvar: ${first.message}`;
  }
  return "Não foi possível salvar. Tente novamente.";
}
