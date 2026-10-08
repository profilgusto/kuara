/**
 * sigaa-roster.test.ts — reading students out of SIGAA's "planilha de notas".
 *
 * The rows below mirror the layout of a real export (blank first column,
 * title block, header on a later row, a blank row at the end); the people in
 * them are made up.
 */
import { describe, it, expect } from "vitest";
import { extractSigaaRoster } from "./sigaa-roster";

const blank = ["", "", "", "", "", "", "", "", ""];
const title = (text: string) => ["", text, "", "", "", "", "", "", ""];
const header = [
  "",
  "Matrícula",
  "Nome",
  "Unid. 1",
  "Rec.",
  "Resultado",
  "Faltas",
  "Sit.",
  "",
];
const student = (registration: unknown, name: unknown) => [
  "",
  registration,
  name,
  "-",
  "-",
  0,
  0,
  0,
  "",
];

function sheet(
  students: unknown[][],
  titleText = "EMT0061 - AUTOMAÇÃO INDUSTRIAL (60h) - Turma: 01A (2026.2)",
) {
  return [
    blank,
    title("PLANILHA DE NOTAS"),
    title(titleText),
    blank,
    title("Digite as notas das unidades utilizando vírgula."),
    title("Altere somente as células em amarelo."),
    blank,
    header,
    ...students,
    blank,
  ];
}

function roster(rows: unknown[][]) {
  const result = extractSigaaRoster(rows);
  if (!result.ok) throw new Error(result.error);
  return result.roster;
}

describe("extractSigaaRoster", () => {
  it("reads matrículas and names from under the header", () => {
    const { students } = roster(
      sheet([
        student("214450010", "Ana Clara de Souza"),
        student("2023011671", "BRUNO HENRIQUE DA SILVA LIMA"),
      ]),
    );
    expect(students).toEqual([
      { registration: "214450010", name: "Ana Clara de Souza" },
      { registration: "2023011671", name: "Bruno Henrique da Silva Lima" },
    ]);
  });

  it("reads the course, class and period from the title line", () => {
    expect(roster(sheet([student("214450010", "Ana")]))).toMatchObject({
      courseCode: "EMT0061",
      classCode: "01A",
      classGroup: "A",
      period: "2026.2",
    });
  });

  it("tells turma B and a whole class apart", () => {
    const one = [student("214450010", "Ana")];
    expect(
      roster(
        sheet(
          one,
          "EMT0061 - AUTOMAÇÃO INDUSTRIAL (60h) - Turma: 01B (2026.2)",
        ),
      ).classGroup,
    ).toBe("B");
    const whole = roster(
      sheet(
        one,
        "EMT0020 - INTRODUÇÃO À ENGENHARIA (30h) - Turma: 01 (2025.1)",
      ),
    );
    expect(whole).toMatchObject({
      classCode: "01",
      classGroup: null,
      period: "2025.1",
    });
  });

  it("still reads the students when the title line is missing", () => {
    const rows = [header, student("214450010", "Ana")];
    expect(roster(rows)).toMatchObject({
      students: [{ registration: "214450010", name: "Ana" }],
      courseCode: null,
      classCode: null,
      classGroup: null,
      period: null,
    });
  });

  it("finds the columns by header text, wherever they are", () => {
    const rows = [
      ["Nome", "E-mail", "MATRICULA"],
      ["CARLA DIAS", "c@x", 214450010],
    ];
    expect(roster(rows).students).toEqual([
      { registration: "214450010", name: "Carla Dias" },
    ]);
  });

  it("accepts a matrícula stored as a number", () => {
    expect(
      roster(sheet([student(204300051, "Ana")])).students[0].registration,
    ).toBe("204300051");
  });

  it("skips blank rows silently and counts the unusable ones", () => {
    const result = roster(
      sheet([
        student("214450010", "Ana"),
        blank,
        student("", "Sem Matrícula"),
        student("abc", "Matrícula Inválida"),
        student("204300051", ""),
        student("224400032", "Bruno"),
      ]),
    );
    expect(result.students.map((s) => s.name)).toEqual(["Ana", "Bruno"]);
    expect(result.skippedRows).toBe(3);
  });

  it("keeps one entry for a matrícula that appears twice", () => {
    const { students } = roster(
      sheet([student("214450010", "Ana"), student("214450010", "ANA SOUZA")]),
    );
    expect(students).toEqual([
      { registration: "214450010", name: "Ana Souza" },
    ]);
  });

  it("refuses a sheet without the two columns", () => {
    const result = extractSigaaRoster([
      ["Código", "Disciplina"],
      ["EMT0061", "Automação"],
    ]);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("“Matrícula” e “Nome”"),
    });
  });

  it("refuses a sheet with a header and nobody under it", () => {
    expect(extractSigaaRoster(sheet([])).ok).toBe(false);
    expect(extractSigaaRoster([]).ok).toBe(false);
  });

  it("survives rows that are not arrays", () => {
    const rows = [
      null,
      header,
      undefined,
      student("214450010", "Ana"),
    ] as unknown[][];
    expect(roster(rows).students).toHaveLength(1);
  });
});
