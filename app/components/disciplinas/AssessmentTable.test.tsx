/**
 * AssessmentTable.test.tsx — the assessments of an offer: the list, the
 * inline row that adds one, and the footer sums.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AssessmentTable } from "./AssessmentTable";
import type { AssessmentRow } from "@/lib/assessment";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const assessments: AssessmentRow[] = [
  {
    id: 1,
    code: "P1",
    name: "Prova 1",
    weight: 4,
    category: "regular",
    scoredBy: "student",
    mode: "graded" as const,
    tasks: [],
  },
  {
    id: 2,
    code: "TF",
    name: "Trabalho Final",
    weight: 3.5,
    category: "regular",
    scoredBy: "student",
    mode: "graded" as const,
    tasks: [],
  },
  {
    id: 3,
    code: "EXT",
    name: "Extensão",
    weight: 1,
    category: "extra",
    scoredBy: "student",
    mode: "graded" as const,
    tasks: [],
  },
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

const table = (rows = assessments) =>
  render(<AssessmentTable offerId={7} assessments={rows} />);

/** Cell texts of the body rows that hold saved assessments. */
const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((row) =>
      within(row)
        .queryAllByRole("cell")
        .map((cell) => cell.textContent),
    )
    .filter((cells) => cells.length >= 6 && cells[0] !== "")
    .map((cells) => cells.slice(0, 5));

/** The footer's figure for one of the three sums. */
function footer(kind: "regular" | "extra" | "total") {
  return document.querySelector(`[data-total="${kind}"]`) as HTMLElement;
}

const openRow = () =>
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar avaliação" }));

function fill(code: string, name: string, weight: string, category?: string) {
  fireEvent.change(screen.getByLabelText("Código"), {
    target: { value: code },
  });
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Peso"), {
    target: { value: weight },
  });
  if (category) {
    fireEvent.change(screen.getByLabelText("Tipo pontuação"), {
      target: { value: category },
    });
  }
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

beforeEach(() => {
  router.refresh.mockClear();
  vi.unstubAllGlobals();
});

describe("the list", () => {
  it("shows code, name, points with one decimal, and type", () => {
    table();
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual([
      "Código",
      "Nome",
      "Peso",
      "Tipo pontuação",
      "Pontuação por",
      "Avaliada por",
      "Entrega",
      "Comentário",
    ]);
    expect(bodyRows()).toEqual([
      ["P1", "Prova 1", "4.0", "Regular", "Discente"],
      ["TF", "Trabalho Final", "3.5", "Regular", "Discente"],
      ["EXT", "Extensão", "1.0", "Extra", "Discente"],
    ]);
  });

  it("says so when the offer has none", () => {
    table([]);
    expect(
      screen.getByText("Nenhuma avaliação cadastrada nesta oferta."),
    ).toBeTruthy();
  });
});

describe("the footer", () => {
  it("adds up regular, extra and total points", () => {
    table();
    expect(footer("regular").textContent).toBe("7.5");
    expect(footer("extra").textContent).toBe("1.0");
    expect(footer("total").textContent).toBe("8.5");
  });

  it("fits on a single line of the table", () => {
    table();
    const foot = screen.getAllByRole("rowgroup")[2];
    expect(within(foot).getAllByRole("row")).toHaveLength(1);
    expect(foot.textContent).toMatch(/Regulares.*Extras.*Total/);
  });

  it("flags the regular sum while it is not exactly 10.0", () => {
    table();
    const cell = footer("regular");
    expect(cell.getAttribute("data-complete")).toBe("false");
    expect(cell.className).toContain("text-red-600");
    expect(screen.getByText("deve somar 10.0")).toBeTruthy();
  });

  it("stops flagging once the regular sum is 10.0", () => {
    table([
      ...assessments,
      {
        id: 4,
        code: "P2",
        name: "Prova 2",
        weight: 2.5,
        category: "regular",
        scoredBy: "student",
        mode: "graded" as const,
        tasks: [],
      },
    ]);
    const cell = footer("regular");
    expect(cell.textContent).toBe("10.0");
    expect(cell.getAttribute("data-complete")).toBe("true");
    expect(cell.className).not.toContain("text-red-600");
    expect(footer("total").textContent).toBe("11.0");
  });

  it("flags a regular sum above 10.0 too", () => {
    table([
      ...assessments,
      {
        id: 4,
        code: "P2",
        name: "Prova 2",
        weight: 3,
        category: "regular",
        scoredBy: "student",
        mode: "graded" as const,
        tasks: [],
      },
    ]);
    expect(footer("regular").getAttribute("data-complete")).toBe("false");
  });

  it("shows zeros, flagged, for an empty offer", () => {
    table([]);
    expect(footer("regular").textContent).toBe("0.0");
    expect(footer("regular").getAttribute("data-complete")).toBe("false");
    expect(footer("total").textContent).toBe("0.0");
  });
});

describe("adding an assessment", () => {
  it("opens an empty row in the table, with Salvar and Descartar", () => {
    table();
    expect(screen.queryByLabelText("Código")).toBeNull();
    openRow();

    for (const label of [
      "Código",
      "Nome",
      "Peso",
      "Tipo pontuação",
      "Pontuação por",
    ]) {
      expect(screen.getByLabelText(label).closest("table")).toBeTruthy();
    }
    expect(
      (screen.getByLabelText("Tipo pontuação") as HTMLSelectElement).value,
    ).toBe("regular");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeTruthy();
    // One new row at a time.
    expect(
      (
        screen.getByRole("button", {
          name: "Cadastrar avaliação",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("tidies the code and the points as they are typed", () => {
    table();
    openRow();
    fill("p 2", "Prova 2", "2x,5");
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe(
      "P2",
    );
    expect((screen.getByLabelText("Peso") as HTMLInputElement).value).toBe(
      "2,5",
    );
  });

  it("saves the row, adds it to the list and updates the sums", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    table();
    openRow();
    fill("p2", " Prova  2 ", "2,5");
    save();

    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/activities?depth=0");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({
      offer: 7,
      acronym: "P2",
      description: "Prova 2",
      weight: 2.5,
      category: "regular",
      type: "individual",
      mode: "graded",
      dueDate: null,
      comment: null,
      order: 3,
    });
    expect(bodyRows().at(-1)).toEqual([
      "P2",
      "Prova 2",
      "2.5",
      "Regular",
      "Discente",
    ]);
    expect(footer("regular").textContent).toBe("10.0");
    expect(footer("regular").getAttribute("data-complete")).toBe("true");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("saves an extra assessment as extra", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    table();
    openRow();
    fill("BON", "Bônus", "0.5", "extra");
    save();

    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).category).toBe("extra");
    expect(footer("extra").textContent).toBe("1.5");
    expect(footer("regular").textContent).toBe("7.5");
  });

  it("saves an assessment graded per group", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    table();
    openRow();
    expect(
      (screen.getByLabelText("Pontuação por") as HTMLSelectElement).value,
    ).toBe("student");
    fill("SEM", "Seminário", "2.5");
    fireEvent.change(screen.getByLabelText("Pontuação por"), {
      target: { value: "group" },
    });
    save();

    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).type).toBe("group");
    expect(bodyRows().at(-1)).toEqual([
      "SEM",
      "Seminário",
      "2.5",
      "Regular",
      "Grupo",
    ]);
  });

  it("does not show a saved row twice once the server list has it", async () => {
    mockFetch(201, { doc: { id: 9 } });
    const { rerender } = table();
    openRow();
    fill("P2", "Prova 2", "2.5");
    save();
    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());

    rerender(
      <AssessmentTable
        offerId={7}
        assessments={[
          ...assessments,
          {
            id: 9,
            code: "P2",
            name: "Prova 2",
            weight: 2.5,
            category: "regular",
            scoredBy: "student",
            mode: "graded" as const,
            tasks: [],
          },
        ]}
      />,
    );
    expect(bodyRows().filter((row) => row[0] === "P2")).toHaveLength(1);
    expect(footer("regular").textContent).toBe("10.0");
  });

  it("discards the row without calling the server", () => {
    const fetchMock = mockFetch(201);
    table();
    openRow();
    fill("P2", "Prova 2", "2.5");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(screen.queryByLabelText("Código")).toBeNull();
    expect(bodyRows()).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();

    // Reopening starts empty.
    openRow();
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("discards on Escape", () => {
    table();
    openRow();
    fireEvent.keyDown(screen.getByLabelText("Nome"), { key: "Escape" });
    expect(screen.queryByLabelText("Código")).toBeNull();
  });

  it("keeps the row open and explains an invalid value", () => {
    const fetchMock = mockFetch(201);
    table();
    openRow();
    fill("P2", "Prova 2", "12");
    save();
    expect(screen.getByRole("alert").textContent).toMatch(/0\.1 a 10\.0/);

    fill("tf", "Outro", "2");
    save();
    expect(screen.getByRole("alert").textContent).toBe(
      "Já existe uma avaliação com o código TF.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Código")).toBeTruthy();
  });

  it("keeps what was typed when the server refuses", async () => {
    mockFetch(403, { errors: [{ message: "Forbidden" }] });
    table();
    openRow();
    fill("P2", "Prova 2", "2.5");
    save();

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
      "Prova 2",
    );
    expect(bodyRows()).toHaveLength(3);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("reports a duplicate code caught only by the server", async () => {
    mockFetch(400, { errors: [{ data: { errors: [{ path: "acronym" }] } }] });
    table();
    openRow();
    fill("P2", "Prova 2", "2.5");
    save();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Já existe uma avaliação com o código P2.",
    );
  });
});

describe("editing the table", () => {
  const startEditing = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de avaliações" }),
    );
  const rowButtons = () =>
    screen
      .queryAllByRole("button", { name: /^(Editar|Remover) [A-Z0-9]+$/ })
      .map((b) => b.getAttribute("aria-label"));

  it("shows a pencil and a bin per row only in edit mode", () => {
    table();
    expect(rowButtons()).toEqual([]);

    startEditing();
    expect(rowButtons()).toEqual([
      "Editar P1",
      "Remover P1",
      "Editar TF",
      "Remover TF",
      "Editar EXT",
      "Remover EXT",
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Sair da edição da tabela" }),
    );
    expect(rowButtons()).toEqual([]);
  });

  it("opens a per-group assessment with Grupo selected, and can switch it", async () => {
    const fetchMock = mockFetch(200, { doc: { id: 5 } });
    table([
      {
        id: 5,
        code: "SEM",
        name: "Seminário",
        weight: 2,
        category: "regular",
        scoredBy: "group",
        mode: "graded" as const,
        tasks: [],
      },
    ]);
    expect(bodyRows()[0][4]).toBe("Grupo");
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Editar SEM" }));
    const select = screen.getByLabelText("Pontuação por") as HTMLSelectElement;
    expect(select.value).toBe("group");

    fireEvent.change(select, { target: { value: "student" } });
    save();
    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).type).toBe("individual");
    expect(bodyRows()[0][4]).toBe("Discente");
  });

  it("turns a row into fields holding its current values", () => {
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Editar TF" }));

    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe(
      "TF",
    );
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
      "Trabalho Final",
    );
    expect((screen.getByLabelText("Peso") as HTMLInputElement).value).toBe(
      "3.5",
    );
    expect(
      (screen.getByLabelText("Tipo pontuação") as HTMLSelectElement).value,
    ).toBe("regular");
    // In place: the other two rows are still there, around it.
    expect(bodyRows().map((r) => r[0])).toEqual(["P1", "EXT"]);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
  });

  it("saves the changed row with a PATCH and updates the sums", async () => {
    const fetchMock = mockFetch(200, { doc: { id: 2 } });
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Editar TF" }));
    fill("tf2", "Trabalho Final Revisado", "6", "extra");
    save();

    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/activities/2?depth=0");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      acronym: "TF2",
      description: "Trabalho Final Revisado",
      weight: 6,
      category: "extra",
      type: "individual",
      mode: "graded",
      dueDate: null,
      comment: null,
    });
    expect(bodyRows()).toEqual([
      ["P1", "Prova 1", "4.0", "Regular", "Discente"],
      ["TF2", "Trabalho Final Revisado", "6.0", "Extra", "Discente"],
      ["EXT", "Extensão", "1.0", "Extra", "Discente"],
    ]);
    expect(footer("regular").textContent).toBe("4.0");
    expect(footer("extra").textContent).toBe("7.0");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("lets a row keep its own code, but not take another row's", async () => {
    const fetchMock = mockFetch(200, { doc: { id: 2 } });
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Editar TF" }));
    fill("P1", "Trabalho Final", "3.5");
    save();
    expect(screen.getByRole("alert").textContent).toBe(
      "Já existe uma avaliação com o código P1.",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    fill("TF", "Trabalho Final", "2");
    save();
    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("discards an edit, leaving the row as it was", () => {
    const fetchMock = mockFetch(200);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Editar TF" }));
    fill("ZZ", "Outro", "9");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(bodyRows()[1]).toEqual([
      "TF",
      "Trabalho Final",
      "3.5",
      "Regular",
      "Discente",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("works on one row at a time", () => {
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Editar TF" }));

    for (const name of ["Editar P1", "Remover P1", "Cadastrar avaliação"]) {
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    }
  });

  it("drops an open edit when edit mode is switched off", () => {
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Editar TF" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Sair da edição da tabela" }),
    );
    expect(screen.queryByLabelText("Código")).toBeNull();
    expect(bodyRows()).toHaveLength(3);
  });

  it("asks before removing, and does nothing on cancel", () => {
    const fetchMock = mockFetch(200);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remover TF" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("TF");
    expect(dialog.textContent).toContain("Trabalho Final");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(bodyRows()).toHaveLength(3);
  });

  it("removes the assessment once confirmed and updates the sums", async () => {
    const fetchMock = mockFetch(200);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remover TF" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remover",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/activities/2");
    expect(init.method).toBe("DELETE");
    expect(bodyRows().map((r) => r[0])).toEqual(["P1", "EXT"]);
    expect(footer("regular").textContent).toBe("4.0");
    expect(footer("total").textContent).toBe("5.0");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps the row and explains when the server refuses to remove", async () => {
    mockFetch(403);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remover TF" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remover",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(bodyRows()).toHaveLength(3);
  });
});

describe("due date and comment", () => {
  it("are saved when given, and shown in the list", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    table();
    openRow();
    fill("P2", "Prova 2", "2.5");
    fireEvent.change(screen.getByLabelText("Entrega"), {
      target: { value: "2026-11-05" },
    });
    fireEvent.change(screen.getByLabelText("Comentário"), {
      target: { value: "Com consulta ao caderno." },
    });
    save();

    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.dueDate).toBe("2026-11-05T12:00:00.000Z");
    expect(body.comment).toBe("Com consulta ao caderno.");
    expect(screen.getByText("05/11/2026")).toBeTruthy();
    expect(screen.getByText("Com consulta ao caderno.")).toBeTruthy();
  });

  it("can be cleared again when editing", async () => {
    const fetchMock = mockFetch(200, { doc: { id: 1 } });
    table([{ ...assessments[0], dueDate: "2026-11-05", comment: "Em duplas" }]);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de avaliações" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar P1" }));
    expect((screen.getByLabelText("Entrega") as HTMLInputElement).value).toBe(
      "2026-11-05",
    );
    fireEvent.change(screen.getByLabelText("Entrega"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Comentário"), {
      target: { value: "" },
    });
    save();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.dueDate).toBeNull();
    expect(body.comment).toBeNull();
  });
});

describe("an assessment graded by tasks", () => {
  const exercises: AssessmentRow = {
    id: 8,
    code: "EX",
    name: "Exercícios",
    weight: 2,
    category: "regular",
    scoredBy: "student",
    mode: "checklist",
    tasks: [
      { id: "t1", name: "Lista 1" },
      { id: "t2", name: "Lista 2" },
    ],
  };
  const startEditing = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de avaliações" }),
    );
  const openTasks = () => {
    startEditing();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar as tarefas de EX" }),
    );
    return screen.getByRole("dialog");
  };
  const taskNames = () =>
    screen
      .getAllByLabelText(/^Nome da tarefa \d+$/)
      .map((input) => (input as HTMLInputElement).value);
  const insert = (name: string) => {
    fireEvent.change(screen.getByLabelText("Nova tarefa"), {
      target: { value: name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Inserir" }));
  };

  it("says how each assessment is graded", () => {
    table([...assessments, exercises]);
    const lastCells = screen
      .getAllByRole("row")
      .slice(1, 5)
      .map((row) => within(row).getAllByRole("cell")[5].textContent);
    expect(lastCells).toEqual(["Nota", "Nota", "Nota", "Tarefas · 2"]);
  });

  it("can be chosen when the assessment is created", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    table();
    openRow();
    expect(
      (screen.getByLabelText("Avaliada por") as HTMLSelectElement).value,
    ).toBe("graded");
    fill("EX", "Exercícios", "2");
    fireEvent.change(screen.getByLabelText("Avaliada por"), {
      target: { value: "checklist" },
    });
    save();

    await waitFor(() => expect(screen.queryByLabelText("Código")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).mode).toBe("checklist");
    // It starts with no tasks.
    expect(screen.getByText("Tarefas · 0")).toBeTruthy();
  });

  it("only lets the tasks be edited in edit mode", () => {
    table([exercises]);
    expect(
      screen.queryByRole("button", { name: "Editar as tarefas de EX" }),
    ).toBeNull();
    startEditing();
    expect(
      screen.getByRole("button", { name: "Editar as tarefas de EX" }),
    ).toBeTruthy();
  });

  it("opens the tasks with their names, and what each is worth", () => {
    table([exercises]);
    const dialog = openTasks();
    expect(taskNames()).toEqual(["Lista 1", "Lista 2"]);
    // 2.0 points over 2 tasks.
    expect(dialog.textContent).toContain("cada uma vale cerca de 1.0");
  });

  it("adds tasks one after the other, keeping the cursor in the field", () => {
    table([exercises]);
    openTasks();
    insert("Lista 3");
    insert("  Quiz   surpresa ");

    expect(taskNames()).toEqual([
      "Lista 1",
      "Lista 2",
      "Lista 3",
      "Quiz surpresa",
    ]);
    const field = screen.getByLabelText("Nova tarefa") as HTMLInputElement;
    expect(field.value).toBe("");
    expect(document.activeElement).toBe(field);
  });

  it("refuses a second task with the same name", () => {
    table([exercises]);
    openTasks();
    insert("lista 1");
    expect(screen.getByRole("alert").textContent).toBe(
      "Há duas tarefas chamadas “lista 1”.",
    );
    expect(taskNames()).toHaveLength(2);
  });

  it("saves the whole list, keeping the ids of the tasks that stay", async () => {
    const fetchMock = mockFetch(200, {
      doc: {
        tasks: [
          { id: "t1", name: "Lista A" },
          { id: "t9", name: "Lista 3" },
        ],
      },
    });
    table([exercises]);
    openTasks();
    fireEvent.change(screen.getByLabelText("Nome da tarefa 1"), {
      target: { value: "Lista A" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Remover tarefa Lista 2" }),
    );
    insert("Lista 3");
    // Removing a saved task loses what students did in it.
    expect(screen.getByText(/Uma tarefa já salva será removida/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar tarefas" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/activities/8?depth=0");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      tasks: [{ id: "t1", name: "Lista A" }, { name: "Lista 3" }],
    });
    expect(
      screen.getByRole("button", { name: "Editar as tarefas de EX" })
        .textContent,
    ).toBe("Tarefas · 2");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("gives tasks an acronym, sent with the list", async () => {
    const fetchMock = mockFetch(200, { doc: { tasks: [] } });
    table([exercises]);
    openTasks();
    fireEvent.change(screen.getByLabelText("Acrônimo da tarefa 1"), {
      target: { value: "l 1" },
    });
    expect(
      (screen.getByLabelText("Acrônimo da tarefa 1") as HTMLInputElement).value,
    ).toBe("L1");
    fireEvent.change(screen.getByLabelText("Acrônimo"), {
      target: { value: "l3" },
    });
    insert("Lista 3");
    fireEvent.click(screen.getByRole("button", { name: "Salvar tarefas" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tasks).toEqual([
      { id: "t1", code: "L1", name: "Lista 1" },
      { id: "t2", name: "Lista 2" },
      { code: "L3", name: "Lista 3" },
    ]);
  });

  it("saves nothing on cancel", () => {
    const fetchMock = mockFetch(200);
    table([exercises]);
    const dialog = openTasks();
    insert("Lista 3");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Editar as tarefas de EX" })
        .textContent,
    ).toBe("Tarefas · 2");
  });

  it("refuses to save a task left without a name", () => {
    const fetchMock = mockFetch(200);
    table([exercises]);
    openTasks();
    fireEvent.change(screen.getByLabelText("Nome da tarefa 2"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar tarefas" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Dê um nome a cada tarefa.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("leaving with changes not saved", () => {
    const closeX = () =>
      fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    const asking = () => screen.queryByText("Sair sem salvar?");

    it("closes straight away when nothing was changed", () => {
      table([exercises]);
      openTasks();
      closeX();
      expect(asking()).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("asks first when a task was added, renamed or removed", () => {
      table([exercises]);
      openTasks();
      insert("Lista 3");
      closeX();
      expect(asking()).toBeTruthy();
      // Still there, behind the question.
      expect(taskNames()).toEqual(["Lista 1", "Lista 2", "Lista 3"]);
    });

    it("asks on Escape too, and for a name still being typed", () => {
      table([exercises]);
      const dialog = openTasks();
      fireEvent.change(screen.getByLabelText("Nova tarefa"), {
        target: { value: "Lista 3" },
      });
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(asking()).toBeTruthy();
    });

    it("goes back to the list on “Continuar editando”", () => {
      table([exercises]);
      openTasks();
      fireEvent.change(screen.getByLabelText("Nome da tarefa 1"), {
        target: { value: "Lista A" },
      });
      closeX();
      fireEvent.click(
        screen.getByRole("button", { name: "Continuar editando" }),
      );

      expect(asking()).toBeNull();
      expect(taskNames()).toEqual(["Lista A", "Lista 2"]);
    });

    it("throws the changes away on “Descartar alterações”", () => {
      const fetchMock = mockFetch(200);
      table([exercises]);
      openTasks();
      fireEvent.click(
        screen.getByRole("button", { name: "Remover tarefa Lista 2" }),
      );
      closeX();
      fireEvent.click(
        screen.getByRole("button", { name: "Descartar alterações" }),
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      // Reopening starts from what is saved.
      fireEvent.click(
        screen.getByRole("button", { name: "Editar as tarefas de EX" }),
      );
      expect(taskNames()).toEqual(["Lista 1", "Lista 2"]);
    });

    it("does not ask after “Cancelar”, which already says it", () => {
      table([exercises]);
      openTasks();
      insert("Lista 3");
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(asking()).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("stops asking once a change is undone by hand", () => {
      table([exercises]);
      openTasks();
      fireEvent.change(screen.getByLabelText("Nome da tarefa 1"), {
        target: { value: "Lista A" },
      });
      fireEvent.change(screen.getByLabelText("Nome da tarefa 1"), {
        target: { value: "Lista 1" },
      });
      closeX();
      expect(asking()).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("gives each task a grip to drag it by", () => {
    table([exercises]);
    openTasks();
    expect(
      screen
        .getAllByRole("button", { name: /^Mover tarefa / })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Mover tarefa Lista 1", "Mover tarefa Lista 2"]);
  });
});
