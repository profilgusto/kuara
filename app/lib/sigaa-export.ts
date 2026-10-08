/**
 * lib/sigaa-export.ts — filling SIGAA's "planilha de notas" with the grades
 * kept in Kuara, so the file can be sent back to SIGAA.
 *
 * SIGAA exports one sheet per class with a column for each assessment
 * registered there, named by its abbreviation:
 *
 *   Matrícula | Nome        | Unid. 1                 | Rec. | Resultado | …
 *             |             | EC | SE | PP | TF | Nota |      |           |
 *   214450010 | FULANO      | -  | -  | -  | -  | (fx) | -    | (fx)      |
 *
 * The teacher's own sheet is the template: its grade cells are overwritten
 * in place and every other byte — formulas, colours, protection — is left as
 * SIGAA wrote it. Columns are matched to Kuara's assessments by code, rows
 * to students by matrícula, and grades go in as points with one decimal.
 *
 * SIGAA only knows the regular assessments, whose weights add up to 10.0.
 * Bonus points can be folded into them: added to the grades a student
 * already has, never past an assessment's own maximum.
 *
 * Pure throughout; lib/sheet-reader.ts does the file reading and writing.
 */
import type { AssessmentRow } from "./assessment";
import type { EnrollmentRow } from "./enrollment";
import { normalizeRegistration } from "./enrollment";
import { percentageFor, pointsFor, type ScoreRow } from "./grades";
import { foldText } from "./person-name";

export interface GradeSheetColumn {
  /** Zero-based column in the sheet. */
  col: number;
  /** The assessment's abbreviation, as SIGAA wrote it. */
  code: string;
}

export interface GradeSheetLayout {
  columns: GradeSheetColumn[];
  /** Zero-based row of each student, with the matrícula found there. */
  students: { row: number; registration: string }[];
  courseCode: string | null;
  classCode: string | null;
  period: string | null;
}

export type GradeSheetResult =
  | { ok: true; layout: GradeSheetLayout }
  | { ok: false; error: string };

const cellText = (cell: unknown): string =>
  typeof cell === "string"
    ? cell.trim()
    : typeof cell === "number"
      ? String(cell)
      : "";

const TITLE_PATTERN =
  /^\s*([A-Z]{2,5}\d{3,5})\s*-.*?Turma:\s*(\d{1,2}\s*[A-Za-z]?)\s*\((\d{4}\.\d)\)/;

/** Columns of SIGAA's own that sit beside the assessments. */
const NOT_AN_ASSESSMENT = new Set([
  "nota",
  "rec.",
  "rec",
  "resultado",
  "faltas",
  "sit.",
  "sit",
]);

/**
 * Finds, in the rows of a SIGAA grade sheet, where each assessment's column
 * and each student's row are.
 */
export function readGradeSheetLayout(rows: unknown[][]): GradeSheetResult {
  let headerRow = -1;
  let registrationCol = -1;
  let nameCol = -1;
  let courseCode: string | null = null;
  let classCode: string | null = null;
  let period: string | null = null;

  for (const [index, row] of rows.entries()) {
    if (!Array.isArray(row)) continue;
    const texts = row.map(cellText);
    if (!classCode) {
      const title = texts.map((t) => TITLE_PATTERN.exec(t)).find(Boolean);
      if (title) {
        courseCode = title[1];
        classCode = title[2].replace(/\s+/g, "").toUpperCase();
        period = title[3];
      }
    }
    const folded = texts.map(foldText);
    if (folded.includes("matricula") && folded.includes("nome")) {
      headerRow = index;
      registrationCol = folded.indexOf("matricula");
      nameCol = folded.indexOf("nome");
      break;
    }
  }

  if (headerRow === -1) {
    return {
      ok: false,
      error:
        "Não encontrei as colunas “Matrícula” e “Nome”. Envie a planilha de notas exportada do SIGAA.",
    };
  }

  // With assessments registered in SIGAA, their abbreviations sit on a row
  // of their own under the header. Without any, the students come right
  // after it — and there is no column to put a grade in.
  const nextRow = rows[headerRow + 1];
  if (
    Array.isArray(nextRow) &&
    normalizeRegistration(nextRow[registrationCol]) !== null
  ) {
    return {
      ok: false,
      error:
        "Esta planilha foi exportada sem avaliações cadastradas. Cadastre as avaliações no SIGAA, com as mesmas abreviações usadas aqui, e exporte a planilha de novo.",
    };
  }

  const columns: GradeSheetColumn[] = [];
  if (Array.isArray(nextRow)) {
    nextRow.forEach((cell, col) => {
      const code = cellText(cell);
      if (col <= nameCol || col === registrationCol || !code) return;
      if (NOT_AN_ASSESSMENT.has(foldText(code))) return;
      columns.push({ col, code });
    });
  }
  if (columns.length === 0) {
    return {
      ok: false,
      error:
        "Não reconheci as colunas de avaliação desta planilha. Exporte-a de novo do SIGAA, sem editá-la.",
    };
  }

  const students: GradeSheetLayout["students"] = [];
  for (let row = headerRow + 2; row < rows.length; row++) {
    const cells = rows[row];
    if (!Array.isArray(cells)) continue;
    const registration = normalizeRegistration(cells[registrationCol]);
    if (registration) students.push({ row, registration });
  }
  if (students.length === 0) {
    return {
      ok: false,
      error: "A planilha não tem nenhum discente abaixo do cabeçalho.",
    };
  }

  return {
    ok: true,
    layout: { columns, students, courseCode, classCode, period },
  };
}

const toTenths = (points: number) => Math.round(points * 10);

/**
 * Folds bonus points into a student's grades, all in tenths of a point.
 *
 * `grades` are the points obtained in each regular assessment (null where
 * there is no grade yet) and `maxima` what each is worth. The bonus tops the
 * graded assessments up in order, each no further than its maximum; what
 * does not fit anywhere comes back as `leftover`.
 */
export function distributeExtra(
  grades: (number | null)[],
  maxima: number[],
  extra: number,
): { grades: (number | null)[]; leftover: number } {
  let left = Math.max(0, extra);
  const result = grades.map((grade, index) => {
    if (grade === null || left === 0) return grade;
    const room = Math.max(0, maxima[index] - grade);
    const added = Math.min(room, left);
    left -= added;
    return grade + added;
  });
  return { grades: result, leftover: left };
}

/**
 * A student's points in each of the given regular assessments, in tenths
 * (null where there is no grade), with the bonus folded in when asked.
 */
function studentTenths(
  student: Pick<EnrollmentRow, "id">,
  regular: AssessmentRow[],
  extras: AssessmentRow[],
  scores: ScoreRow[],
  withExtras: boolean,
): { grades: (number | null)[]; leftover: number } {
  const tenthsIn = (assessment: AssessmentRow) => {
    const percentage = percentageFor(student, assessment, scores);
    return percentage === null
      ? null
      : toTenths(pointsFor(percentage, assessment.weight));
  };
  const grades = regular.map(tenthsIn);
  if (!withExtras) return { grades, leftover: 0 };

  const extra = extras.reduce((sum, a) => sum + (tenthsIn(a) ?? 0), 0);
  return distributeExtra(
    grades,
    regular.map((a) => toTenths(a.weight)),
    extra,
  );
}

export interface SheetCellValue {
  row: number;
  col: number;
  /** Points, with one decimal at most. */
  value: number;
}

export interface GradeExport {
  cells: SheetCellValue[];
  /** Assessments of the sheet that Kuara has under the same code. */
  matchedCodes: string[];
  /** Columns of the sheet with no regular assessment of that code here. */
  unknownCodes: string[];
  /**
   * Regular assessments here that the sheet has no column for. Not a
   * problem: only what SIGAA has is sent.
   */
  missingCodes: string[];
  /** Matrículas of the sheet that are not enrolled in this offer. */
  unknownStudents: string[];
  /** Students of the sheet who have at least one grade to write. */
  gradedStudents: number;
  /** Students whose bonus points did not all fit, and how much was lost. */
  overflow: { registration: string; name: string; lostPoints: number }[];
}

/**
 * Works out what to write in each grade cell of the sheet.
 *
 * A cell is only written where the student has a grade in Kuara; the others
 * keep whatever the sheet already holds. With `withExtras`, each student's
 * bonus points are folded into their regular grades (see `distributeExtra`).
 */
export function buildGradeExport({
  layout,
  enrollments,
  assessments,
  scores,
  withExtras,
}: {
  layout: GradeSheetLayout;
  enrollments: Pick<EnrollmentRow, "id" | "registration" | "name">[];
  assessments: AssessmentRow[];
  scores: ScoreRow[];
  withExtras: boolean;
}): GradeExport {
  const regular = assessments.filter((a) => a.category !== "extra");
  const extras = assessments.filter((a) => a.category === "extra");
  const byCode = new Map(regular.map((a) => [foldText(a.code), a]));

  const matched = layout.columns.flatMap((column) => {
    const assessment = byCode.get(foldText(column.code));
    return assessment ? [{ column, assessment }] : [];
  });
  const matchedIds = new Set(matched.map((m) => String(m.assessment.id)));
  const byRegistration = new Map(enrollments.map((e) => [e.registration, e]));

  const cells: SheetCellValue[] = [];
  const unknownStudents: string[] = [];
  const overflow: GradeExport["overflow"] = [];
  let gradedStudents = 0;

  for (const { row, registration } of layout.students) {
    const student = byRegistration.get(registration);
    if (!student) {
      unknownStudents.push(registration);
      continue;
    }

    const { grades, leftover } = studentTenths(
      student,
      matched.map((m) => m.assessment),
      extras,
      scores,
      withExtras,
    );
    if (leftover > 0) {
      overflow.push({
        registration,
        name: student.name,
        lostPoints: leftover / 10,
      });
    }

    let any = false;
    grades.forEach((grade, index) => {
      if (grade === null) return;
      any = true;
      cells.push({ row, col: matched[index].column.col, value: grade / 10 });
    });
    if (any) gradedStudents += 1;
  }

  return {
    cells,
    matchedCodes: matched.map((m) => m.column.code),
    unknownCodes: layout.columns
      .filter((c) => !byCode.has(foldText(c.code)))
      .map((c) => c.code),
    missingCodes: regular
      .filter((a) => !matchedIds.has(String(a.id)))
      .map((a) => a.code),
    unknownStudents,
    gradedStudents,
    overflow,
  };
}

// ── Writing into the .xls itself ────────────────────────────────────────────

const RECORD_LABELSST = 0x00fd;
/** A string stored in the cell itself rather than in the shared table. */
const RECORD_LABEL = 0x0204;
const RECORD_RK = 0x027e;
const RECORD_NUMBER = 0x0203;
const RECORD_FILEPASS = 0x002f;

/**
 * A number with at most two decimals as a BIFF "RK" value: the number times
 * 100 as an integer, flagged as such. Exact for grades like 7.5 or 10.
 */
export function encodeRk(value: number): number {
  return ((Math.round(value * 100) << 2) | 0b11) >>> 0;
}

export interface PatchResult {
  /** Cells written. */
  written: number;
  /** Cells that could not be written, as [row, col]. */
  skipped: [number, number][];
  /** The workbook is password-encrypted; nothing was touched. */
  encrypted: boolean;
}

/**
 * Overwrites cells of a BIFF8 workbook stream (the "Workbook" stream inside
 * an .xls file) with numbers, **in place**: no record changes size, so every
 * offset, formula, style and protection flag in the file stays valid.
 *
 * A cell holding a number keeps its record and gets the new value. A cell
 * holding SIGAA's "-" for "no grade" — a shared string, or a one-character
 * inline one — becomes an RK number record, which is exactly as long. Both keep the cell's format, so
 * the yellow, one-decimal look survives. Any other kind of cell (formula,
 * blank, a cell that does not exist) is reported back, untouched.
 *
 * Works on the first sheet, which is the only one SIGAA writes.
 */
export function patchBiffNumbers(
  stream: Uint8Array,
  cells: SheetCellValue[],
): PatchResult {
  const wanted = new Map(cells.map((c) => [`${c.row}:${c.col}`, c.value]));
  const done = new Set<string>();
  const view = new DataView(stream.buffer, stream.byteOffset, stream.length);

  let encrypted = false;
  let substream = 0; // 1 = workbook globals, 2 = first sheet, …
  let depth = 0;
  for (let p = 0; p + 4 <= stream.length; ) {
    const id = view.getUint16(p, true);
    const length = view.getUint16(p + 2, true);
    const body = p + 4;
    if (body + length > stream.length) break;

    if (id === 0x0809) {
      if (depth === 0) substream += 1;
      depth += 1;
    } else if (id === 0x000a) {
      depth = Math.max(0, depth - 1);
    } else if (id === RECORD_FILEPASS) {
      encrypted = true;
      break;
    } else if (
      substream === 2 &&
      (id === RECORD_LABELSST ||
        id === RECORD_RK ||
        id === RECORD_NUMBER ||
        // An inline one-character string ("-") happens to be 10 bytes too;
        // a longer one could not be replaced without moving what follows.
        (id === RECORD_LABEL && length === 10)) &&
      length >= 10
    ) {
      const key = `${view.getUint16(body, true)}:${view.getUint16(body + 2, true)}`;
      const value = wanted.get(key);
      if (value !== undefined && !done.has(key)) {
        if (id === RECORD_NUMBER) {
          view.setFloat64(body + 6, value, true);
        } else {
          // Same 10-byte body either way: row, col, format, 4 bytes of value.
          view.setUint16(p, RECORD_RK, true);
          view.setUint32(body + 6, encodeRk(value), true);
        }
        done.add(key);
      }
    }
    p = body + length;
  }

  if (encrypted) {
    return { written: 0, skipped: cells.map((c) => [c.row, c.col]), encrypted };
  }
  return {
    written: done.size,
    skipped: cells
      .filter((c) => !done.has(`${c.row}:${c.col}`))
      .map((c) => [c.row, c.col]),
    encrypted,
  };
}

/** "notas_EMT0061_T01A_20262.xls" → "notas_EMT0061_T01A_20262-kuara.xls". */
export function exportFileName(original: string, withExtras: boolean): string {
  const base = original.replace(/\.xlsx?$/i, "").replace(/\.xls$/i, "");
  return `${base || "notas"}-kuara${withExtras ? "-com-extras" : ""}.xls`;
}
