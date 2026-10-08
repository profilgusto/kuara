/**
 * EnrollStudentsModal.test.tsx — the two ways of enrolling students.
 *
 * The spreadsheet parser is stubbed (`readSheetRows` returns rows directly):
 * reading a real .xls is SheetJS's job, and turning rows into students is
 * covered in lib/sigaa-roster.test.ts. What is checked here is the flow —
 * what is shown, what is sent, what happens on each answer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { EnrollStudentsModal } from "./EnrollStudentsModal";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

let sheetRows: unknown[][] = [];
vi.mock("@/lib/sheet-reader", () => ({
  MAX_SHEET_BYTES: 1000,
  readSheetRows: vi.fn(async () => sheetRows),
}));

const sigaaSheet = (classCode = "01A", period = "2026.2") => [
  [
    "",
    `EMT0061 - AUTOMAÇÃO INDUSTRIAL (60h) - Turma: ${classCode} (${period})`,
  ],
  ["", "Matrícula", "Nome"],
  ["", "214450010", "ANA CLARA DE SOUZA"],
  ["", "204300051", "Bruno Lima"],
];

function mockFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function openModal(enrolled: string[] = []) {
  render(
    <EnrollStudentsModal
      offerId={7}
      offerPeriod="2026.2"
      enrolledRegistrations={enrolled}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar aluno(s)" }));
  return screen.getByRole("dialog");
}

async function upload(size = 100) {
  const file = new File([new Uint8Array(size)], "notas_EMT0061.xls");
  fireEvent.change(screen.getByLabelText(/Escolher planilha/), {
    target: { files: [file] },
  });
}

/** The radio that is checked inside the section with the given heading. */
const chosenGroup = (heading: string) => {
  const section = screen.getByRole("region", { name: new RegExp(heading) });
  const checked = within(section)
    .getAllByRole("radio")
    .find((radio) => (radio as HTMLInputElement).checked);
  return checked?.parentElement?.textContent;
};

beforeEach(() => {
  router.refresh.mockClear();
  vi.unstubAllGlobals();
  sheetRows = sigaaSheet();
});

describe("the modal", () => {
  it("opens with both sections and the offer it is for", () => {
    const dialog = openModal();
    expect(within(dialog).getByText("2026.2")).toBeTruthy();
    expect(screen.getByText("Importar planilha do SIGAA")).toBeTruthy();
    expect(screen.getByText("Cadastrar manualmente")).toBeTruthy();
  });

  it("closes from the X", () => {
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("importing a spreadsheet", () => {
  it("shows the students found, with names in title case, before saving", async () => {
    const fetchMock = mockFetch(200);
    openModal();
    await upload();

    expect(await screen.findByText("Ana Clara de Souza")).toBeTruthy();
    expect(screen.getByText("Bruno Lima")).toBeTruthy();
    expect(screen.getByText("2 discentes")).toBeTruthy();
    expect(screen.getByText(/EMT0061, turma 01A, 2026\.2/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pre-selects the turma written in the sheet's title", async () => {
    openModal();
    expect(chosenGroup("Importar planilha")).toBe("Turma completa");
    await upload();
    await screen.findByText("Bruno Lima");
    expect(chosenGroup("Importar planilha")).toBe("Turma A");
  });

  it("sends the students with the turma chosen, then refreshes the page", async () => {
    const fetchMock = mockFetch(200, { created: 2, updated: 0, unchanged: 0 });
    openModal();
    await upload();
    await screen.findByText("Bruno Lima");

    const section = screen.getByRole("region", { name: /Importar planilha/ });
    fireEvent.click(within(section).getByLabelText("Turma B"));
    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar 2 discentes · Turma B/ }),
    );

    expect((await screen.findByRole("status")).textContent).toBe(
      "2 discentes cadastrados — Turma B.",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/enrollments/import");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({
      offer: 7,
      classGroup: "B",
      students: [
        { registration: "214450010", name: "Ana Clara de Souza" },
        { registration: "204300051", name: "Bruno Lima" },
      ],
    });
    expect(router.refresh).toHaveBeenCalled();
    // The reviewed list is gone: the same sheet cannot be sent twice by reflex.
    expect(screen.queryByText("Bruno Lima")).toBeNull();
  });

  it("sends a whole class as a null turma", async () => {
    sheetRows = sigaaSheet("01");
    const fetchMock = mockFetch(200, { created: 2, updated: 0, unchanged: 0 });
    openModal();
    await upload();
    await screen.findByText("Bruno Lima");
    fireEvent.click(
      screen.getByRole("button", {
        name: /Cadastrar 2 discentes · Turma completa/,
      }),
    );

    await screen.findByRole("status");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).classGroup).toBeNull();
  });

  it("reports updates and repeats in the result", async () => {
    mockFetch(200, { created: 1, updated: 1, unchanged: 3 });
    openModal();
    await upload();
    await screen.findByText("Bruno Lima");
    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar 2 discentes/ }),
    );

    expect((await screen.findByRole("status")).textContent).toBe(
      "1 discente cadastrado, 1 atualizado(s), 3 já estava(m) na oferta — Turma A.",
    );
  });

  it("warns when the sheet is from another period", async () => {
    sheetRows = sigaaSheet("01A", "2025.1");
    openModal();
    await upload();
    expect(
      await screen.findByText(/A planilha é de 2025\.1, mas a oferta aberta é/),
    ).toBeTruthy();
  });

  it("says how many are already in the offer", async () => {
    openModal(["204300051"]);
    await upload();
    expect(await screen.findByText(/1 já está nesta oferta/)).toBeTruthy();
  });

  it("explains a file that is not the SIGAA sheet", async () => {
    sheetRows = [["Código", "Disciplina"]];
    openModal();
    await upload();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /“Matrícula” e “Nome”/,
    );
    expect(screen.queryByRole("button", { name: /Cadastrar \d/ })).toBeNull();
  });

  it("refuses a file that is too large without reading it", async () => {
    openModal();
    await upload(1001);
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /grande demais/,
    );
  });

  it("keeps the reviewed list when the server refuses", async () => {
    mockFetch(403, { error: "Acesso negado." });
    openModal();
    await upload();
    await screen.findByText("Bruno Lima");
    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar 2 discentes/ }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(screen.getByText("Bruno Lima")).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("drops the sheet on request", async () => {
    openModal();
    await upload();
    await screen.findByText("Bruno Lima");
    fireEvent.click(screen.getByRole("button", { name: "Descartar planilha" }));
    expect(screen.queryByText("Bruno Lima")).toBeNull();
  });
});

describe("adding one student by hand", () => {
  const fill = (registration: string, name: string) => {
    fireEvent.change(screen.getByLabelText("Matrícula"), {
      target: { value: registration },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: name },
    });
  };
  const submit = () =>
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar discente" }));

  it("only lets digits into the matrícula", () => {
    openModal();
    fill("21a4-45.0010", "Ana");
    expect((screen.getByLabelText("Matrícula") as HTMLInputElement).value).toBe(
      "214450010",
    );
  });

  it("creates the enrollment and clears the fields for the next one", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 1 } });
    openModal();
    fill("214450010", "  Ana   Souza ");
    const section = screen.getByRole("region", {
      name: /Cadastrar manualmente/,
    });
    fireEvent.click(within(section).getByLabelText("Turma A"));
    submit();

    expect((await screen.findByRole("status")).textContent).toBe(
      "Ana Souza cadastrado(a) — Turma A.",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/enrollments?depth=0");
    expect(JSON.parse(init.body)).toEqual({
      offer: 7,
      registration: "214450010",
      name: "Ana Souza",
      classGroup: "A",
    });
    expect((screen.getByLabelText("Matrícula") as HTMLInputElement).value).toBe(
      "",
    );
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("refuses an incomplete student without calling the server", () => {
    const fetchMock = mockFetch(201);
    openModal();
    fill("214450010", "   ");
    submit();
    expect(screen.getByRole("alert").textContent).toBe(
      "Informe o nome do discente.",
    );
    fill("12", "Ana");
    submit();
    expect(screen.getByRole("alert").textContent).toMatch(/4 a 20 dígitos/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a matrícula already in the offer", () => {
    const fetchMock = mockFetch(201);
    openModal(["214450010"]);
    fill("214450010", "Ana");
    submit();
    expect(screen.getByRole("alert").textContent).toBe(
      "A matrícula 214450010 já está cadastrada nesta oferta.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a duplicate caught only by the server, keeping what was typed", async () => {
    mockFetch(400, {
      errors: [{ data: { errors: [{ path: "registration" }] } }],
    });
    openModal();
    fill("214450010", "Ana");
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /já está cadastrada/,
      ),
    );
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
      "Ana",
    );
  });
});
