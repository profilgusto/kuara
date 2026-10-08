/**
 * lib/sigaa-roster.ts — reads the students out of SIGAA's "Planilha de
 * notas" (the .xls a teacher exports for a class).
 *
 * The sheet opens with a title block, then a header row holding "Matrícula"
 * and "Nome", then one student per row:
 *
 *   EMT0061 - AUTOMAÇÃO INDUSTRIAL (60h) - Turma: 01A (2026.2)
 *   …
 *   Matrícula | Nome | Unid. 1 | Rec. | Resultado | Faltas | Sit.
 *   214450010 | FULANO DE TAL | …
 *
 * Works on rows already read from the file (an array of cell arrays), so it
 * is pure; lib/sheet-reader.ts does the reading. Columns are found by their
 * header text, not by position.
 */
import {
  normalizeRegistration,
  type ClassGroup,
  type StudentEntry,
} from "./enrollment";
import { foldText, formatPersonName } from "./person-name";

export interface SigaaRoster {
  students: StudentEntry[];
  /** From the title line, when present. */
  courseCode: string | null;
  /** The class as SIGAA writes it: "01", "01A", "02B". */
  classCode: string | null;
  /** "A" or "B" when the class code ends in one; null for a whole class. */
  classGroup: ClassGroup | null;
  period: string | null;
  /** Rows under the header that had no usable matrícula and name. */
  skippedRows: number;
}

export type RosterResult =
  | { ok: true; roster: SigaaRoster }
  | { ok: false; error: string };

const cellText = (cell: unknown): string =>
  typeof cell === "string"
    ? cell.trim()
    : typeof cell === "number"
      ? String(cell)
      : "";

const TITLE_PATTERN =
  /^\s*([A-Z]{2,5}\d{3,5})\s*-.*?Turma:\s*(\d{1,2}\s*[A-Za-z]?)\s*\((\d{4}\.\d)\)/;

export function extractSigaaRoster(rows: unknown[][]): RosterResult {
  let headerIndex = -1;
  let registrationColumn = -1;
  let nameColumn = -1;
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
    const registrationAt = folded.indexOf("matricula");
    const nameAt = folded.indexOf("nome");
    if (registrationAt !== -1 && nameAt !== -1) {
      headerIndex = index;
      registrationColumn = registrationAt;
      nameColumn = nameAt;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      ok: false,
      error:
        "Não encontrei as colunas “Matrícula” e “Nome”. Envie a planilha de notas exportada do SIGAA.",
    };
  }

  const byRegistration = new Map<string, StudentEntry>();
  let skippedRows = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    if (!Array.isArray(row)) continue;
    const rawRegistration = row[registrationColumn];
    const rawName = cellText(row[nameColumn]);
    if (cellText(rawRegistration) === "" && rawName === "") continue;

    const registration = normalizeRegistration(rawRegistration);
    if (!registration || !rawName) {
      skippedRows += 1;
      continue;
    }
    byRegistration.set(registration, {
      registration,
      name: formatPersonName(rawName),
    });
  }

  if (byRegistration.size === 0) {
    return {
      ok: false,
      error: "A planilha não tem nenhum discente abaixo do cabeçalho.",
    };
  }

  const suffix = classCode?.slice(-1);
  return {
    ok: true,
    roster: {
      students: [...byRegistration.values()],
      courseCode,
      classCode,
      classGroup: suffix === "A" || suffix === "B" ? suffix : null,
      period,
      skippedRows,
    },
  };
}
