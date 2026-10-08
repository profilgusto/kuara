/**
 * lib/enrollment.ts — the students enrolled in an offer: shapes, validation
 * of what the "Cadastrar aluno(s)" modal sends, and the table's ordering.
 *
 * Pure: shared by the modal, the table and the import endpoint
 * (collections/Enrollments.ts).
 */
import { foldText } from "./person-name";

/** A class split in two: "A" or "B". Null is the whole class. */
export const CLASS_GROUPS = ["A", "B"] as const;
export type ClassGroup = (typeof CLASS_GROUPS)[number];

export interface StudentEntry {
  registration: string;
  name: string;
}

export interface EnrollmentRow extends StudentEntry {
  id: string | number;
  classGroup?: ClassGroup | null;
  /** The semester-long work group the student belongs to, if any. */
  groupId?: string | number | null;
}

/** A work group of the offer ("Grupo 1", "Equipe Alfa"). */
export interface StudentGroupOption {
  id: string | number;
  name: string;
}

/** One block of the table's "by group" view. */
export interface EnrollmentSection<T extends EnrollmentRow = EnrollmentRow> {
  /** Null for the students who are in no group. */
  group: StudentGroupOption | null;
  rows: T[];
}

export const MAX_IMPORT_SIZE = 500;
export const MAX_STUDENT_NAME_LENGTH = 200;

/** A matrícula as stored: digits only, 4 to 20 of them. */
export function normalizeRegistration(value: unknown): string | null {
  const text =
    typeof value === "number" && Number.isFinite(value)
      ? String(Math.trunc(value))
      : typeof value === "string"
        ? value.trim()
        : "";
  return /^\d{4,20}$/.test(text) ? text : null;
}

export function parseClassGroup(value: unknown): ClassGroup | null {
  return CLASS_GROUPS.find((group) => group === value) ?? null;
}

export type StudentResult =
  | { ok: true; student: StudentEntry }
  | { ok: false; error: string };

/** Checks one student as typed in the modal's manual section. */
export function validateStudent(
  registration: unknown,
  name: unknown,
): StudentResult {
  const normalized = normalizeRegistration(registration);
  if (!normalized) {
    return {
      ok: false,
      error: "Informe a matrícula usando apenas números (4 a 20 dígitos).",
    };
  }
  const cleanName =
    typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!cleanName) return { ok: false, error: "Informe o nome do discente." };
  if (cleanName.length > MAX_STUDENT_NAME_LENGTH) {
    return { ok: false, error: "O nome é longo demais." };
  }
  return { ok: true, student: { registration: normalized, name: cleanName } };
}

export type ImportResult =
  | {
      ok: true;
      offer: string | number;
      classGroup: ClassGroup | null;
      students: StudentEntry[];
    }
  | { ok: false; error: string };

/**
 * Checks the body of POST /api/enrollments/import. Unknown keys are dropped,
 * and a matrícula listed twice keeps its last entry.
 */
export function validateEnrollmentImport(input: unknown): ImportResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const raw = input as Record<string, unknown>;

  const offer = raw.offer;
  if (
    !(typeof offer === "number" && Number.isInteger(offer)) &&
    !(typeof offer === "string" && offer.trim() !== "")
  ) {
    return { ok: false, error: "Oferta não informada." };
  }

  if (
    raw.classGroup !== null &&
    raw.classGroup !== undefined &&
    parseClassGroup(raw.classGroup) === null
  ) {
    return { ok: false, error: "Turma inválida." };
  }

  if (!Array.isArray(raw.students) || raw.students.length === 0) {
    return { ok: false, error: "Nenhum discente para cadastrar." };
  }
  if (raw.students.length > MAX_IMPORT_SIZE) {
    return {
      ok: false,
      error: `Cadastre no máximo ${MAX_IMPORT_SIZE} discentes por vez.`,
    };
  }

  const byRegistration = new Map<string, StudentEntry>();
  for (const [index, item] of raw.students.entries()) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const result = validateStudent(entry.registration, entry.name);
    if (!result.ok) {
      return { ok: false, error: `Linha ${index + 1}: ${result.error}` };
    }
    byRegistration.set(result.student.registration, result.student);
  }

  return {
    ok: true,
    offer,
    classGroup: parseClassGroup(raw.classGroup),
    students: [...byRegistration.values()],
  };
}

export type EnrollmentSortField = "name" | "registration" | "classGroup";

const collator = new Intl.Collator("pt-BR", { numeric: true });

/** Turma A, then B, then the students in neither — whatever the direction. */
const classGroupRank = (row: EnrollmentRow) =>
  row.classGroup === "A" ? 0 : row.classGroup === "B" ? 1 : 2;

/** Rows matching the search (name or matrícula), in the chosen order. */
export function filterAndSortEnrollments<T extends EnrollmentRow>(
  rows: T[],
  search: string,
  field: EnrollmentSortField,
  direction: "asc" | "desc",
): T[] {
  const query = foldText(search.trim());
  const sign = direction === "asc" ? 1 : -1;
  const byName = (a: T, b: T) =>
    collator.compare(foldText(a.name), foldText(b.name));

  return rows
    .filter(
      (row) =>
        !query ||
        foldText(row.name).includes(query) ||
        row.registration.includes(query),
    )
    .sort((a, b) => {
      if (field === "registration") {
        const diff = collator.compare(a.registration, b.registration);
        // Ties always fall back to the name, A→Z.
        return diff !== 0 ? sign * diff : byName(a, b);
      }
      if (field === "classGroup") {
        const ra = classGroupRank(a);
        const rb = classGroupRank(b);
        if (ra === rb) return byName(a, b);
        // Students with no turma stay last even when the order is flipped:
        // only A and B trade places.
        if (ra === 2 || rb === 2) return ra - rb;
        return sign * (ra - rb);
      }
      return sign * byName(a, b);
    });
}

export function classGroupLabel(group: ClassGroup | null | undefined): string {
  return group ? `Turma ${group}` : "Turma completa";
}

/**
 * Splits students into the sections of the "by group" view: one per group,
 * in alphabetical order ("Grupo 2" before "Grupo 10"), then the students in
 * no group. Rows keep the order they arrive in, so sort them first.
 *
 * A group with nobody in it still gets its (empty) section; the ungrouped
 * section only exists when there is someone to put in it. A student pointing
 * at a group that is not in `groups` counts as ungrouped.
 */
export function groupEnrollments<T extends EnrollmentRow>(
  rows: T[],
  groups: StudentGroupOption[],
): EnrollmentSection<T>[] {
  const sections = [...groups]
    .sort((a, b) => collator.compare(foldText(a.name), foldText(b.name)))
    .map((group) => ({ group, rows: [] as T[] }));
  const byId = new Map(
    sections.map((section) => [String(section.group.id), section]),
  );

  const ungrouped: T[] = [];
  for (const row of rows) {
    const section =
      row.groupId === null || row.groupId === undefined
        ? undefined
        : byId.get(String(row.groupId));
    if (section) section.rows.push(row);
    else ungrouped.push(row);
  }

  return ungrouped.length > 0
    ? [...sections, { group: null, rows: ungrouped }]
    : sections;
}

/** Id of the drop zone for a section of the "by group" view. */
export function sectionDropId(group: StudentGroupOption | null): string {
  return group ? `group:${group.id}` : "ungrouped";
}

/**
 * The group a drop zone stands for: its id (as text), or null for the
 * "Sem grupo" zone. Undefined when the id is not a drop zone at all.
 */
export function groupOfDropId(dropId: unknown): string | null | undefined {
  if (dropId === "ungrouped") return null;
  if (typeof dropId === "string" && dropId.startsWith("group:")) {
    return dropId.slice("group:".length) || undefined;
  }
  return undefined;
}
