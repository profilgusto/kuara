/**
 * SigaaExportModal.test.tsx — the panel that fills SIGAA's grade sheet.
 *
 * Reading and writing the .xls are stubbed: `readSheetRows` returns rows
 * directly and `patchXlsNumbers` records what it was asked to write. Both
 * are covered against real files in lib/sigaa-export.test.ts; here it is the
 * flow — what the panel reports, what it asks, what it sends to be written.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SigaaExportModal } from "./SigaaExportModal";
import type { AssessmentRow } from "@/lib/assessment";

let sheetRows: unknown[][] = [];
const patch = vi.fn();
vi.mock("@/lib/sheet-reader", () => ({
  MAX_SHEET_BYTES: 1000,
  readSheetRows: vi.fn(async () => sheetRows),
  patchXlsNumbers: (...args: unknown[]) => patch(...args),
}));

const sigaaSheet = (period = "2026.2") => [
  ["", `EMT0061 - AUTOMAÇÃO INDUSTRIAL (60h) - Turma: 01A (${period})`],
  ["", "Matrícula", "Nome", "Unid. 1", "", "", "Rec.", "Resultado"],
  ["", "", "", "EC", "TF", "   Nota   ", "", ""],
  ["", "214450010", "ANA CLARA DE SOUZA", "-", "-", 0, "-", 0],
  ["", "204300051", "Bruno Lima", "-", "-", 0, "-", 0],
  ["", "777777777", "Fora do Kuara", "-", "-", 0, "-", 0],
];

const assessment = (
  id: number,
  code: string,
  weight: number,
  category: "regular" | "extra" = "regular",
): AssessmentRow => ({
  id,
  code,
  name: code,
  weight,
  category,
  scoredBy: "student",
  mode: "graded" as const,
  tasks: [],
});
const regular = [assessment(1, "EC", 4), assessment(2, "TF", 6)];
const bonus = assessment(3, "BON", 1, "extra");

const enrollments = [
  { id: 10, registration: "214450010", name: "Ana Clara de Souza" },
  { id: 11, registration: "204300051", name: "Bruno Lima" },
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
// Ana: 50% of EC (2.0), 100% of TF (6.0), full bonus. Bruno: 100% of EC only.
const scores = [
  score(1, 10, 50),
  score(2, 10, 100),
  score(3, 10, 100),
  score(1, 11, 100),
  score(3, 11, 100),
];

function openModal(assessments = [...regular, bonus]) {
  render(
    <SigaaExportModal
      offerPeriod="2026.2"
      enrollments={enrollments}
      assessments={assessments}
      scores={scores}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Baixar notas para o SIGAA" }),
  );
}

async function upload(size = 100) {
  const file = new File([new Uint8Array(size)], "notas_EMT0061_T01A_20262.xls");
  fireEvent.change(screen.getByLabelText(/Escolher planilha do SIGAA/), {
    target: { files: [file] },
  });
  await screen.findByText(/com nota para preencher/);
}

const download = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Baixar planilha preenchida" }),
  );

/** The cells handed to the writer, as "row:col=value". */
const writtenCells = () =>
  (
    patch.mock.calls.at(-1)![1] as { row: number; col: number; value: number }[]
  ).map((c) => `${c.row}:${c.col}=${c.value}`);

beforeEach(() => {
  sheetRows = sigaaSheet();
  patch.mockReset();
  patch.mockImplementation(async (_data: unknown, cells: unknown[]) => ({
    file: new Uint8Array([1, 2, 3]),
    result: { written: cells.length, skipped: [], encrypted: false },
  }));
  // jsdom has neither; the download itself is the browser's business.
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

describe("SigaaExportModal", () => {
  it("asks for the sheet first, with nothing to download yet", () => {
    openModal();
    expect(screen.getByText("Escolher planilha do SIGAA")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Baixar planilha preenchida" }),
    ).toBeNull();
  });

  it("shows how the sheet lines up with the offer", async () => {
    openModal();
    await upload();

    expect(screen.getByText("3 discentes")).toBeTruthy();
    expect(screen.getByText(/EMT0061, turma 01A, 2026\.2/)).toBeTruthy();
    expect(screen.getByText(/2 com nota para preencher/)).toBeTruthy();
    expect(screen.getByText("vale 4.0")).toBeTruthy();
    expect(screen.getByText("vale 6.0")).toBeTruthy();
    // In the sheet, not enrolled here.
    expect(
      screen.getByText(/1 matrícula\(s\) da planilha/).textContent,
    ).toContain("777777777");
  });

  it("fills in the regular grades, in points, leaving the bonus out by default", async () => {
    openModal();
    await upload();
    download();

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    // Rows 3 and 4 of the sheet; EC is column 3, TF column 4.
    expect(writtenCells()).toEqual(["3:3=2", "3:4=6", "4:3=4"]);
    expect((await screen.findByRole("status")).textContent).toBe(
      "notas_EMT0061_T01A_20262-kuara.xls baixado, com 3 nota(s) preenchida(s).",
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("folds the bonus into the regular grades when asked", async () => {
    openModal();
    await upload();
    fireEvent.click(screen.getByLabelText(/Com os pontos extras incorporados/));
    download();

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    // Ana's 1.0 bonus goes into EC (2.0 → 3.0). Bruno has no room for his.
    expect(writtenCells()).toEqual(["3:3=3", "3:4=6", "4:3=4"]);
    expect((await screen.findByRole("status")).textContent).toContain(
      "-kuara-com-extras.xls",
    );
  });

  it("says who loses bonus points that do not fit", async () => {
    openModal();
    await upload();
    expect(screen.queryByText(/não coube/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/Com os pontos extras incorporados/));
    expect(screen.getByText(/não coube/).textContent).toContain(
      "Bruno Lima (1.0)",
    );
  });

  it("does not ask about bonus points when the offer has none", async () => {
    openModal(regular);
    await upload();
    expect(screen.queryByText("Pontos extras")).toBeNull();
    download();
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(writtenCells()).toEqual(["3:3=2", "3:4=6", "4:3=4"]);
  });

  it("warns about a column it has no assessment for, and notes what stays out", async () => {
    openModal([assessment(1, "EC", 4), assessment(9, "P9", 6)]);
    await upload();
    expect(
      screen.getByText(/Sem avaliação regular com o mesmo código/).textContent,
    ).toContain("TF");
    expect(
      screen.getByText(/Só vai para a planilha o que o SIGAA tem/).textContent,
    ).toContain("P9");
    expect(screen.getByText("não existe aqui")).toBeTruthy();
  });

  it("warns when the sheet is from another period", async () => {
    sheetRows = sigaaSheet("2025.1");
    openModal();
    await upload();
    expect(
      screen.getByText(/A planilha é de 2025\.1, mas a oferta aberta é/),
    ).toBeTruthy();
  });

  it("explains a file that is not SIGAA's sheet", async () => {
    sheetRows = [["Código", "Disciplina"]];
    openModal();
    const file = new File([new Uint8Array(10)], "outra.xls");
    fireEvent.change(screen.getByLabelText(/Escolher planilha do SIGAA/), {
      target: { files: [file] },
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /“Matrícula” e “Nome”/,
    );
  });

  it("does not hand over a file whose cells could not all be written", async () => {
    patch.mockResolvedValue({
      file: new Uint8Array([1]),
      result: { written: 1, skipped: [[3, 4]], encrypted: false },
    });
    openModal();
    await upload();
    download();

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /não puderam ser preenchidas/,
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("explains a file that cannot be patched at all", async () => {
    patch.mockRejectedValue(new Error("Not a legacy .xls workbook"));
    openModal();
    await upload();
    download();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /\.xls original do SIGAA/,
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe("what the sheet does not ask for", () => {
  it("leaves out assessments that only exist here, without making a fuss", async () => {
    // The offer also has P9; SIGAA's sheet has no column for it.
    openModal([...regular, assessment(9, "P9", 2), bonus]);
    await upload();
    expect(
      screen.getByText(/Só vai para a planilha o que o SIGAA tem/).textContent,
    ).toContain("P9");
    download();
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(writtenCells()).toEqual(["3:3=2", "3:4=6", "4:3=4"]);
  });

  it("only writes the students listed in the sheet", async () => {
    // A third student is enrolled here but belongs to the other subturma.
    render(
      <SigaaExportModal
        offerPeriod="2026.2"
        enrollments={[
          ...enrollments,
          { id: 12, registration: "555555555", name: "Da Outra Turma" },
        ]}
        assessments={regular}
        scores={[...scores, score(1, 12, 100), score(2, 12, 100)]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Baixar notas para o SIGAA" }),
    );
    await upload();
    download();
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(writtenCells()).toEqual(["3:3=2", "3:4=6", "4:3=4"]);
  });

  it("refuses a sheet exported before the assessments were registered", async () => {
    sheetRows = [
      ["", "EMT0061 - AUTOMAÇÃO INDUSTRIAL (60h) - Turma: 01A (2026.2)"],
      [
        "",
        "Matrícula",
        "Nome",
        "Unid. 1",
        "Rec.",
        "Resultado",
        "Faltas",
        "Sit.",
      ],
      ["", "214450010", "ANA CLARA DE SOUZA", "-", "-", 0, 0, 0],
    ];
    openModal();
    const file = new File([new Uint8Array(10)], "notas.xls");
    fireEvent.change(screen.getByLabelText(/Escolher planilha do SIGAA/), {
      target: { files: [file] },
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /sem avaliações cadastradas/,
    );
    expect(
      screen.queryByRole("button", { name: "Baixar planilha preenchida" }),
    ).toBeNull();
  });
});
