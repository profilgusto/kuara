// @vitest-environment node
/**
 * sigaa-export.test.ts — filling SIGAA's grade sheet from Kuara's grades.
 *
 * The sheets below mirror the layout of a real export (blank first column,
 * title block, "Unid. 1" header over the abbreviations, formulas beside the
 * grades); the people in them are made up. The .xls ones are real BIFF8
 * files, written and read back with SheetJS, so the in-place patch is
 * checked against an actual parser rather than against itself.
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildGradeExport,
  distributeExtra,
  encodeRk,
  exportFileName,
  patchBiffNumbers,
  readGradeSheetLayout,
  type GradeSheetLayout,
} from "./sigaa-export";
import { patchXlsNumbers } from "./sheet-reader";

const TITLE = "EMT0061 - AUTOMAÇÃO INDUSTRIAL (60h) - Turma: 01A (2026.2)";

/** Rows of a SIGAA grade sheet with the given abbreviations and students. */
function sheetRows(
  codes: string[],
  students: [registration: unknown, name: string, ...grades: unknown[]][],
) {
  const pad = (cells: unknown[]) => ["", ...cells, ""];
  return [
    pad([]),
    pad(["PLANILHA DE NOTAS"]),
    pad([TITLE]),
    pad([]),
    pad(["Altere somente as células em amarelo."]),
    pad([]),
    pad([
      "Matrícula",
      "Nome",
      "Unid. 1",
      ...codes.slice(1).map(() => ""),
      "",
      "Rec.",
      "Resultado",
      "Faltas",
      "Sit.",
    ]),
    pad(["", "", ...codes, "   Nota   ", "", "", "", ""]),
    ...students.map(([registration, name, ...grades]) =>
      pad([
        registration,
        name,
        ...codes.map((_, i) => grades[i] ?? "-"),
        0,
        "-",
        0,
        0,
        "",
      ]),
    ),
    pad([]),
  ];
}

const rows = sheetRows(
  ["EC", "SE", "PP", "TF"],
  [
    ["214450010", "ANA CLARA DE SOUZA", 1, 2, 3, 4],
    ["204300051", "Bruno Lima"],
    ["2023011671", "Carlos Reis"],
  ],
);

function layoutOf(sheet: unknown[][]): GradeSheetLayout {
  const result = readGradeSheetLayout(sheet);
  if (!result.ok) throw new Error(result.error);
  return result.layout;
}

describe("readGradeSheetLayout", () => {
  it("finds each assessment's column by its abbreviation", () => {
    expect(layoutOf(rows).columns).toEqual([
      { col: 3, code: "EC" },
      { col: 4, code: "SE" },
      { col: 5, code: "PP" },
      { col: 6, code: "TF" },
    ]);
  });

  it("leaves out SIGAA's own columns beside the assessments", () => {
    const codes = layoutOf(rows).columns.map((c) => c.code);
    for (const own of ["Nota", "Rec.", "Resultado", "Faltas", "Sit."]) {
      expect(codes).not.toContain(own);
    }
  });

  it("finds each student's row by the matrícula", () => {
    expect(layoutOf(rows).students).toEqual([
      { row: 8, registration: "214450010" },
      { row: 9, registration: "204300051" },
      { row: 10, registration: "2023011671" },
    ]);
  });

  it("reads the class and the period from the title", () => {
    expect(layoutOf(rows)).toMatchObject({
      courseCode: "EMT0061",
      classCode: "01A",
      period: "2026.2",
    });
  });

  it("accepts a matrícula stored as a number, and skips rows without one", () => {
    const sheet = sheetRows(
      ["P1"],
      [
        [214450010, "Ana"],
        ["", "Sem Matrícula"],
        ["abc", "X"],
      ],
    );
    expect(layoutOf(sheet).students).toEqual([
      { row: 8, registration: "214450010" },
    ]);
  });

  it("refuses a sheet with no assessment columns", () => {
    const sheet = sheetRows([], [["214450010", "Ana"]]);
    expect(readGradeSheetLayout(sheet)).toEqual({
      ok: false,
      error: expect.stringContaining("Não reconheci as colunas de avaliação"),
    });
  });

  it("refuses a sheet that is not SIGAA's, or has nobody in it", () => {
    expect(readGradeSheetLayout([["Código", "Disciplina"]]).ok).toBe(false);
    expect(readGradeSheetLayout(sheetRows(["P1"], [])).ok).toBe(false);
    expect(readGradeSheetLayout([]).ok).toBe(false);
  });
});

describe("distributeExtra", () => {
  it("tops up the first grade that has room", () => {
    expect(distributeExtra([30, 20], [40, 60], 5)).toEqual({
      grades: [35, 20],
      leftover: 0,
    });
  });

  it("splits the bonus across assessments, never past a maximum", () => {
    // 15 tenths: 10 fit in the first (30 → 40), the other 5 go to the next.
    expect(distributeExtra([30, 20], [40, 60], 15)).toEqual({
      grades: [40, 25],
      leftover: 0,
    });
  });

  it("skips an assessment already at its maximum", () => {
    expect(distributeExtra([40, 20], [40, 60], 10)).toEqual({
      grades: [40, 30],
      leftover: 0,
    });
  });

  it("does not create a grade where the student has none", () => {
    expect(distributeExtra([null, 20, null], [40, 60, 10], 10)).toEqual({
      grades: [null, 30, null],
      leftover: 0,
    });
  });

  it("reports what does not fit anywhere", () => {
    expect(distributeExtra([38, 59], [40, 60], 10)).toEqual({
      grades: [40, 60],
      leftover: 7,
    });
    expect(distributeExtra([null, null], [40, 60], 10)).toEqual({
      grades: [null, null],
      leftover: 10,
    });
  });

  it("leaves everything alone with no bonus", () => {
    expect(distributeExtra([30, null], [40, 60], 0)).toEqual({
      grades: [30, null],
      leftover: 0,
    });
  });
});

describe("buildGradeExport", () => {
  const assessment = (
    id: number,
    code: string,
    weight: number,
    category: "regular" | "extra" = "regular",
  ) => ({
    id,
    code,
    name: code,
    weight,
    category,
    scoredBy: "student" as const,
    mode: "graded" as const,
    tasks: [],
  });
  const assessments = [
    assessment(1, "EC", 1),
    assessment(2, "SE", 2),
    assessment(3, "PP", 3),
    assessment(4, "TF", 4),
    assessment(5, "BON", 1, "extra"),
  ];
  const enrollments = [
    { id: 10, registration: "214450010", name: "Ana Clara de Souza" },
    { id: 11, registration: "204300051", name: "Bruno Lima" },
    { id: 12, registration: "999999999", name: "Fora da Planilha" },
  ];
  const score = (
    assessmentId: number,
    enrollmentId: number,
    percentage: number,
  ) => ({
    id: assessmentId * 100 + enrollmentId,
    assessmentId,
    enrollmentId,
    percentage,
  });
  const layout = layoutOf(rows);
  const build = (scores: ReturnType<typeof score>[], withExtras = false) =>
    buildGradeExport({ layout, enrollments, assessments, scores, withExtras });
  /** "row:col=value" for each cell, in order. */
  const written = (result: ReturnType<typeof build>) =>
    result.cells.map((c) => `${c.row}:${c.col}=${c.value}`);

  it("writes each grade as points, in its assessment's column", () => {
    // Ana: 50% of EC (1.0) and 75% of TF (4.0).
    const result = build([score(1, 10, 50), score(4, 10, 75)]);
    expect(written(result)).toEqual(["8:3=0.5", "8:6=3"]);
    expect(result.gradedStudents).toBe(1);
  });

  it("rounds points to one decimal", () => {
    // 87% of 3.0 = 2.61 → 2.6; 55.5% of 2.0 = 1.11 → 1.1.
    expect(written(build([score(3, 10, 87), score(2, 10, 55.5)]))).toEqual([
      "8:4=1.1",
      "8:5=2.6",
    ]);
  });

  it("writes nothing where there is no grade, and a zero where there is one", () => {
    const result = build([score(1, 11, 0)]);
    expect(written(result)).toEqual(["9:3=0"]);
  });

  it("matches columns to assessments whatever the case of the code", () => {
    const lower = buildGradeExport({
      layout,
      enrollments,
      assessments: [assessment(1, "ec", 1)],
      scores: [score(1, 10, 100)],
      withExtras: false,
    });
    expect(written(lower)).toEqual(["8:3=1"]);
  });

  it("reports what does not line up between the sheet and Kuara", () => {
    const result = buildGradeExport({
      layout,
      enrollments,
      assessments: [
        assessment(1, "EC", 1),
        assessment(9, "P9", 2),
        assessment(5, "BON", 1, "extra"),
      ],
      scores: [],
      withExtras: false,
    });
    expect(result.matchedCodes).toEqual(["EC"]);
    // In the sheet, not here.
    expect(result.unknownCodes).toEqual(["SE", "PP", "TF"]);
    // Here, not in the sheet — bonus assessments are never expected there.
    expect(result.missingCodes).toEqual(["P9"]);
    // "2023011671" is in the sheet but not enrolled here.
    expect(result.unknownStudents).toEqual(["2023011671"]);
  });

  it("ignores bonus points unless asked to fold them in", () => {
    const scores = [score(1, 10, 50), score(5, 10, 100)];
    expect(written(build(scores))).toEqual(["8:3=0.5"]);
  });

  it("folds bonus points into the grades the student has", () => {
    // Ana: 0.5 of 1.0 in EC, 3.0 of 4.0 in TF, plus 1.0 bonus.
    // EC takes 0.5 (to its maximum), TF takes the other 0.5.
    const result = build(
      [score(1, 10, 50), score(4, 10, 75), score(5, 10, 100)],
      true,
    );
    expect(written(result)).toEqual(["8:3=1", "8:6=3.5"]);
    expect(result.overflow).toEqual([]);
  });

  it("says who lost bonus points that did not fit", () => {
    // Bruno: full marks in EC, and a 1.0 bonus with nowhere to go.
    const result = build([score(1, 11, 100), score(5, 11, 100)], true);
    expect(written(result)).toEqual(["9:3=1"]);
    expect(result.overflow).toEqual([
      { registration: "204300051", name: "Bruno Lima", lostPoints: 1 },
    ]);
  });

  it("does not turn a bonus into a grade for a student with none", () => {
    const result = build([score(5, 11, 100)], true);
    expect(result.cells).toEqual([]);
    expect(result.gradedStudents).toBe(0);
    expect(result.overflow).toHaveLength(1);
  });
});

describe("encodeRk", () => {
  /** Decodes an RK value the way a BIFF reader does. */
  const decode = (rk: number) => {
    const integer = (rk & 2) !== 0;
    const scaled = (rk & 1) !== 0;
    if (!integer) throw new Error("not an integer RK");
    const value = rk >> 2;
    return scaled ? value / 100 : value;
  };

  it("round-trips one-decimal grades exactly", () => {
    for (const value of [0, 0.1, 0.7, 1.5, 2.9, 5.9, 6, 7.5, 9.9, 10]) {
      expect(decode(encodeRk(value))).toBe(value);
    }
  });
});

describe("patching a real .xls", () => {
  /** A BIFF8 file with the sheet above, as bytes. */
  function xls(sheet: unknown[][]): ArrayBuffer {
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet0");
    const bytes = XLSX.write(wb, {
      bookType: "biff8",
      type: "array",
      // Shared strings, as in SIGAA's own files: a "-" is then a record of
      // the same size as a number, which is what makes patching possible.
      bookSST: true,
    }) as ArrayBuffer;
    return bytes;
  }
  const read = (file: Uint8Array) => {
    const wb = XLSX.read(file, { type: "array", cellFormula: true });
    return wb.Sheets[wb.SheetNames[0]];
  };
  const cellAt = (ws: XLSX.WorkSheet, row: number, col: number) =>
    ws[XLSX.utils.encode_cell({ r: row, c: col })];

  it("turns a “-” into a number, and replaces a number with another", async () => {
    const { file, result } = await patchXlsNumbers(xls(rows), [
      { row: 9, col: 3, value: 0.7 }, // Bruno's EC: was "-"
      { row: 9, col: 6, value: 10 }, // Bruno's TF: was "-"
      { row: 8, col: 4, value: 1.5 }, // Ana's SE: was 2
    ]);
    expect(result).toEqual({ written: 3, skipped: [], encrypted: false });

    const ws = read(file);
    expect(cellAt(ws, 9, 3)).toMatchObject({ t: "n", v: 0.7 });
    expect(cellAt(ws, 9, 6)).toMatchObject({ t: "n", v: 10 });
    expect(cellAt(ws, 8, 4)).toMatchObject({ t: "n", v: 1.5 });
  });

  it("changes nothing else in the sheet", async () => {
    const original = xls(rows);
    const before = read(new Uint8Array(original));
    const { file } = await patchXlsNumbers(original, [
      { row: 9, col: 3, value: 0.7 },
    ]);
    const after = read(file);

    expect(after["!ref"]).toBe(before["!ref"]);
    for (const address of Object.keys(before)) {
      if (address.startsWith("!") || address === "D10") continue;
      expect([address, after[address]?.v, after[address]?.f]).toEqual([
        address,
        before[address].v,
        before[address].f,
      ]);
    }
    // Other students' "-" and the title are still there.
    expect(cellAt(after, 10, 3).v).toBe("-");
    expect(cellAt(after, 2, 1).v).toBe(TITLE);
  });

  it("keeps the file the same size: nothing moves", async () => {
    const original = xls(rows);
    const stream = (data: ArrayBuffer | Uint8Array) => {
      const cfb = XLSX.CFB.read(new Uint8Array(data), { type: "array" });
      return XLSX.CFB.find(cfb, "/Workbook")!.content.length;
    };
    const { file } = await patchXlsNumbers(original, [
      { row: 9, col: 3, value: 0.7 },
      { row: 8, col: 4, value: 1.5 },
    ]);
    expect(stream(file)).toBe(stream(original));
  });

  it("reports a cell that is not in the sheet", async () => {
    const { result } = await patchXlsNumbers(xls(rows), [
      { row: 40, col: 3, value: 1 }, // no such cell
      { row: 9, col: 3, value: 0.7 },
    ]);
    expect(result.written).toBe(1);
    expect(result.skipped).toEqual([[40, 3]]);
  });

  it("does not touch the original bytes it was given", async () => {
    const original = xls(rows);
    const copy = new Uint8Array(original).slice();
    await patchXlsNumbers(original, [{ row: 9, col: 3, value: 0.7 }]);
    expect(new Uint8Array(original)).toEqual(copy);
  });

  it("refuses a file that is not an .xls workbook", async () => {
    await expect(
      patchXlsNumbers(new TextEncoder().encode("not a spreadsheet").buffer, []),
    ).rejects.toThrow();
  });
});

describe("patchBiffNumbers", () => {
  /** A minimal workbook stream: globals, then a sheet with the records. */
  function stream(records: [id: number, body: number[]][]) {
    const bytes: number[] = [];
    const push = (id: number, body: number[]) =>
      bytes.push(
        id & 255,
        id >> 8,
        body.length & 255,
        body.length >> 8,
        ...body,
      );
    push(0x0809, [0, 6, 5, 0]); // BOF: workbook globals
    push(0x000a, []); // EOF
    push(0x0809, [0, 6, 16, 0]); // BOF: sheet
    for (const [id, body] of records) push(id, body);
    push(0x000a, []);
    return new Uint8Array(bytes);
  }
  const cell = (row: number, col: number, xf: number, rest: number[]) => [
    row,
    0,
    col,
    0,
    xf,
    0,
    ...rest,
  ];

  it("keeps the cell's format when a string becomes a number", () => {
    const data = stream([[0x00fd, cell(5, 3, 0x2a, [7, 0, 0, 0])]]);
    const result = patchBiffNumbers(data, [{ row: 5, col: 3, value: 7.5 }]);
    expect(result.written).toBe(1);

    const view = new DataView(data.buffer);
    const at = 20; // after the two globals records and the sheet's BOF
    expect(view.getUint16(at, true)).toBe(0x027e); // now an RK record
    expect(view.getUint16(at + 2, true)).toBe(10); // same length
    expect(view.getUint16(at + 8, true)).toBe(0x2a); // same format
    expect(view.getUint32(at + 10, true)).toBe(encodeRk(7.5));
  });

  it("writes the new value over a number record, as a double", () => {
    const data = stream([[0x0203, cell(5, 3, 0x2a, [0, 0, 0, 0, 0, 0, 0, 0])]]);
    expect(
      patchBiffNumbers(data, [{ row: 5, col: 3, value: 3.3 }]).written,
    ).toBe(1);
    const view = new DataView(data.buffer);
    expect(view.getUint16(20, true)).toBe(0x0203);
    expect(view.getFloat64(30, true)).toBe(3.3);
  });

  it("never writes over a formula, a blank or a long text", () => {
    const formula = [0x0006, cell(5, 7, 1, new Array(16).fill(0))] as [
      number,
      number[],
    ];
    const blank = [0x0201, cell(5, 8, 1, [])] as [number, number[]];
    const text = [0x0204, cell(5, 2, 1, [3, 0, 0, 65, 78, 65])] as [
      number,
      number[],
    ];
    const data = stream([formula, blank, text]);
    const before = Array.from(data);
    const result = patchBiffNumbers(data, [
      { row: 5, col: 7, value: 1 },
      { row: 5, col: 8, value: 1 },
      { row: 5, col: 2, value: 1 },
    ]);
    expect(result.written).toBe(0);
    expect(result.skipped).toHaveLength(3);
    expect(Array.from(data)).toEqual(before);
  });

  it("ignores cells of the workbook globals and of later sheets' look-alikes", () => {
    // A record with the same id and coordinates, but before the sheet starts.
    const bytes = [
      0x09,
      0x08,
      4,
      0,
      0,
      6,
      5,
      0,
      0xfd,
      0x00,
      10,
      0,
      ...cell(5, 3, 1, [0, 0, 0, 0]),
      0x0a,
      0x00,
      0,
      0,
      0x09,
      0x08,
      4,
      0,
      0,
      6,
      16,
      0,
      0x0a,
      0x00,
      0,
      0,
    ];
    const data = new Uint8Array(bytes);
    const result = patchBiffNumbers(data, [{ row: 5, col: 3, value: 1 }]);
    expect(result).toEqual({ written: 0, skipped: [[5, 3]], encrypted: false });
    expect(Array.from(data)).toEqual(bytes);
  });

  it("refuses an encrypted workbook without touching it", () => {
    const bytes = [
      0x09,
      0x08,
      4,
      0,
      0,
      6,
      5,
      0,
      0x2f,
      0x00,
      2,
      0,
      0,
      0, // FILEPASS
      0x0a,
      0x00,
      0,
      0,
      0x09,
      0x08,
      4,
      0,
      0,
      6,
      16,
      0,
      0xfd,
      0x00,
      10,
      0,
      ...cell(5, 3, 1, [0, 0, 0, 0]),
      0x0a,
      0x00,
      0,
      0,
    ];
    const data = new Uint8Array(bytes);
    expect(patchBiffNumbers(data, [{ row: 5, col: 3, value: 1 }])).toEqual({
      written: 0,
      skipped: [[5, 3]],
      encrypted: true,
    });
    expect(Array.from(data)).toEqual(bytes);
  });

  it("survives a truncated stream", () => {
    const data = stream([[0x00fd, cell(5, 3, 1, [0, 0, 0, 0])]]).slice(0, 25);
    expect(() =>
      patchBiffNumbers(data, [{ row: 5, col: 3, value: 1 }]),
    ).not.toThrow();
  });
});

describe("exportFileName", () => {
  it("marks the file as filled by Kuara, keeping SIGAA's name", () => {
    expect(exportFileName("notas_EMT0061_T01A_20262.xls", false)).toBe(
      "notas_EMT0061_T01A_20262-kuara.xls",
    );
    expect(exportFileName("notas_EMT0061_T01A_20262.xls", true)).toBe(
      "notas_EMT0061_T01A_20262-kuara-com-extras.xls",
    );
  });

  it("copes with doubled or missing extensions", () => {
    expect(exportFileName("notas.xls.xls", false)).toBe("notas-kuara.xls");
    expect(exportFileName("", false)).toBe("notas-kuara.xls");
  });
});

describe("a sheet exported before any assessment was registered", () => {
  it("is refused, with what to do about it", () => {
    const pad = (cells: unknown[]) => ["", ...cells, ""];
    const bare = [
      pad(["PLANILHA DE NOTAS"]),
      pad([TITLE]),
      pad([
        "Matrícula",
        "Nome",
        "Unid. 1",
        "Rec.",
        "Resultado",
        "Faltas",
        "Sit.",
      ]),
      pad(["214450010", "ANA CLARA DE SOUZA", "-", "-", 0, 0, 0]),
      pad(["204300051", "Bruno Lima", "-", "-", 0, 0, 0]),
    ];
    expect(readGradeSheetLayout(bare)).toEqual({
      ok: false,
      error: expect.stringContaining("sem avaliações cadastradas"),
    });
  });
});
