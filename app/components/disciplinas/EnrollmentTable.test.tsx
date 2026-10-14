/**
 * EnrollmentTable.test.tsx — the list of students of an offer.
 *
 * The modal behind "Cadastrar aluno(s)" has its own file; here it is stubbed
 * down to its button.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { EnrollmentTable } from "./EnrollmentTable";
import type { EnrollmentRow } from "@/lib/enrollment";
import type { AssessmentRow } from "@/lib/assessment";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("./GroupsModal", () => ({
  GroupsModal: (props: { groups: { name: string }[] }) => (
    <button>
      Adicionar grupos [{props.groups.map((g) => g.name).join(",")}]
    </button>
  ),
}));

vi.mock("./EnrollStudentsModal", () => ({
  EnrollStudentsModal: (props: { enrolledRegistrations: string[] }) => (
    <button>
      Cadastrar aluno(s) [{props.enrolledRegistrations.join(",")}]
    </button>
  ),
}));

const students: EnrollmentRow[] = [
  { id: 1, registration: "214450010", name: "Bruno Lima" },
  { id: 2, registration: "204300051", name: "Ângela Dias" },
  { id: 3, registration: "2023011671", name: "Carlos Reis" },
];

/** Opens the search box and types into it. */
function searchFor(text: string) {
  if (!screen.queryByRole("searchbox")) {
    fireEvent.click(screen.getByRole("button", { name: "Buscar discente" }));
  }
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: text } });
}

const table = (enrollments = students) =>
  render(
    <EnrollmentTable
      offerId={7}
      offerPeriod="2026.2"
      enrollments={enrollments}
    />,
  );

/** First-column and second-column text of each body row. */
const bodyRows = () =>
  screen
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("cell").length > 0)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    );

describe("EnrollmentTable", () => {
  it("lists matrícula and name, sorted by name", () => {
    table();
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["M.", "Nome"]);
    expect(bodyRows()).toEqual([
      ["204300051", "Ângela Dias"],
      ["214450010", "Bruno Lima"],
      ["2023011671", "Carlos Reis"],
    ]);
  });

  it("flips the order when the active column is clicked again", () => {
    table();
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por nome" }));
    expect(bodyRows().map((r) => r[1])).toEqual([
      "Carlos Reis",
      "Bruno Lima",
      "Ângela Dias",
    ]);
  });

  it("sorts by matrícula on request", () => {
    table();
    fireEvent.click(
      screen.getByRole("button", { name: "Ordenar por matrícula" }),
    );
    expect(bodyRows().map((r) => r[0])).toEqual([
      "204300051",
      "214450010",
      "2023011671",
    ]);
  });

  it("filters as the search is typed and shows how many are left", () => {
    table();
    expect(screen.getByText("3")).toBeTruthy();
    searchFor("angela");
    expect(bodyRows()).toEqual([["204300051", "Ângela Dias"]]);
    expect(screen.getByText("1 de 3")).toBeTruthy();
  });

  it("keeps the search folded into a magnifier until it is clicked", () => {
    table();
    expect(screen.queryByRole("searchbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Buscar discente" }));

    const box = screen.getByRole("searchbox");
    expect(document.activeElement).toBe(box);
    expect(
      screen.queryByRole("button", { name: "Buscar discente" }),
    ).toBeNull();
  });

  it("folds back when left empty, but not while it holds a search", () => {
    table();
    searchFor("");
    fireEvent.blur(screen.getByRole("searchbox"));
    expect(screen.queryByRole("searchbox")).toBeNull();

    searchFor("bruno");
    fireEvent.blur(screen.getByRole("searchbox"));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "bruno",
    );
    expect(bodyRows()).toHaveLength(1);
  });

  it("clears the search and folds back on Escape", () => {
    table();
    searchFor("bruno");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });

    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(bodyRows()).toHaveLength(3);
  });

  it("says so when the search finds nobody", () => {
    table();
    searchFor("zzz");
    expect(screen.getByText("Nenhum discente encontrado.")).toBeTruthy();
  });

  it("says so when the offer has no students yet, keeping the button", () => {
    table([]);
    expect(
      screen.getByText("Nenhum discente cadastrado nesta oferta."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Cadastrar aluno\(s\)/ }),
    ).toBeTruthy();
  });

  it("adds the Turma column, first, only when the class is split", () => {
    table([
      { ...students[0], classGroup: "A" as const },
      { ...students[1], classGroup: "B" as const },
      students[2],
    ]);
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["T.", "M.", "Nome"]);
    expect(bodyRows()).toEqual([
      ["B", "204300051", "Ângela Dias"],
      ["A", "214450010", "Bruno Lima"],
      ["—", "2023011671", "Carlos Reis"],
    ]);
  });

  it("sorts by turma on request, and flips it on a second click", () => {
    table([
      { ...students[0], classGroup: "B" as const }, // Bruno
      { ...students[1], classGroup: "B" as const }, // Ângela
      { ...students[2], classGroup: "A" as const }, // Carlos
      { id: 4, registration: "20991234", name: "Davi Sem Turma" },
    ]);
    const sort = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Ordenar por turma" }),
      );

    sort();
    expect(bodyRows().map((r) => `${r[0]} ${r[2]}`)).toEqual([
      "A Carlos Reis",
      "B Ângela Dias",
      "B Bruno Lima",
      "— Davi Sem Turma",
    ]);
    expect(
      screen
        .getByRole("columnheader", { name: /T\./ })
        .getAttribute("aria-sort"),
    ).toBe("ascending");

    sort();
    expect(bodyRows().map((r) => `${r[0]} ${r[2]}`)).toEqual([
      "B Ângela Dias",
      "B Bruno Lima",
      "A Carlos Reis",
      "— Davi Sem Turma",
    ]);
    expect(
      screen
        .getByRole("columnheader", { name: /T\./ })
        .getAttribute("aria-sort"),
    ).toBe("descending");
  });

  it("tells the modal who is already enrolled", () => {
    table();
    expect(
      screen.getByRole("button", { name: /Cadastrar aluno\(s\)/ }).textContent,
    ).toContain("214450010,204300051,2023011671");
  });
});

describe("editing the table", () => {
  function mockFetch(status: number) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const startEditing = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
  const bins = () => screen.queryAllByRole("button", { name: /^Remover / });
  const namesShown = () => bodyRows().map((row) => row[1]);

  beforeEach(() => {
    router.refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("shows no bins until the pencil is clicked, and hides them again after", () => {
    table();
    expect(bins()).toHaveLength(0);

    startEditing();
    expect(bins().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Remover Ângela Dias",
      "Remover Bruno Lima",
      "Remover Carlos Reis",
    ]);

    const pencil = screen.getByRole("button", {
      name: "Sair da edição da tabela",
    });
    expect(pencil.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pencil);
    expect(bins()).toHaveLength(0);
  });

  it("asks before removing, naming the student, and does nothing on cancel", () => {
    const fetchMock = mockFetch(200);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remover Bruno Lima" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Bruno Lima");
    expect(dialog.textContent).toContain("214450010");
    expect(dialog.textContent).toContain("2026.2");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(namesShown()).toContain("Bruno Lima");
  });

  it("deletes that student once confirmed and drops the row", async () => {
    const fetchMock = mockFetch(200);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remover Bruno Lima" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remover",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/enrollments/1");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("include");
    expect(namesShown()).toEqual(["Ângela Dias", "Carlos Reis"]);
    expect(router.refresh).toHaveBeenCalled();
    // Still in edit mode, to remove the next one.
    expect(bins()).toHaveLength(2);
  });

  it("keeps the row and explains when the server refuses", async () => {
    mockFetch(403);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remover Bruno Lima" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remover",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("treats a student already removed elsewhere as removed", async () => {
    mockFetch(404);
    table();
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remover Bruno Lima" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remover",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(namesShown()).not.toContain("Bruno Lima");
  });
});

describe("viewing by group", () => {
  const groups = [
    { id: 20, name: "Grupo 2" },
    { id: 10, name: "Grupo 1" },
    { id: 30, name: "Grupo 3" },
  ];
  const grouped: EnrollmentRow[] = [
    { ...students[0], groupId: 20 }, // Bruno Lima
    { ...students[1], groupId: 10 }, // Ângela Dias
    { ...students[2], groupId: 20 }, // Carlos Reis
    { id: 4, registration: "20991234", name: "Davi Sem Grupo" },
  ];

  const byGroup = () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={grouped}
        groups={groups}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
  };

  /** The table body as [section title or student name] in screen order. */
  // Each group is its own <tbody>; the first rowgroup is the <thead>.
  const outline = () =>
    screen
      .getAllByRole("rowgroup")
      .slice(1)
      .flatMap((body) => within(body).getAllByRole("row"))
      .map((row) => {
        const head = within(row).queryByRole("rowheader");
        if (head) return `# ${head.textContent}`;
        const cells = within(row).getAllByRole("cell");
        return cells.length > 1 ? cells[1].textContent : cells[0].textContent;
      });

  it("starts on the plain alphabetical list", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={grouped}
        groups={groups}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Ver por alunos" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.queryByRole("rowheader")).toBeNull();
    expect(bodyRows().map((r) => r[1])).toEqual([
      "Ângela Dias",
      "Bruno Lima",
      "Carlos Reis",
      "Davi Sem Grupo",
    ]);
  });

  it("breaks the table into groups, both levels in alphabetical order", () => {
    byGroup();
    expect(
      screen
        .getByRole("button", { name: "Ver por grupos" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(outline()).toEqual([
      "# Grupo 11",
      "Ângela Dias",
      "# Grupo 22",
      "Bruno Lima",
      "Carlos Reis",
      "# Grupo 30",
      "Nenhum integrante.",
      "# Sem grupo1",
      "Davi Sem Grupo",
    ]);
  });

  it("goes back to the plain list", () => {
    byGroup();
    fireEvent.click(screen.getByRole("button", { name: "Ver por alunos" }));
    expect(screen.queryByRole("rowheader")).toBeNull();
    expect(bodyRows()).toHaveLength(4);
  });

  it("while searching, shows only the groups with a match", () => {
    byGroup();
    searchFor("carlos");
    expect(outline()).toEqual(["# Grupo 21", "Carlos Reis"]);
  });

  it("in edit mode, offers to remove groups and to take students out of them", () => {
    byGroup();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
    expect(
      screen
        .getAllByRole("button", { name: /^Remover / })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Remover grupo Grupo 1",
      "Remover Ângela Dias do grupo",
      "Remover grupo Grupo 2",
      "Remover Bruno Lima do grupo",
      "Remover Carlos Reis do grupo",
      "Remover grupo Grupo 3",
      // Davi is in no group: nothing to take him out of.
    ]);
  });

  it("takes a student out of the group at once, without removing them from the offer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    byGroup();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remover Bruno Lima do grupo" }),
    );

    // No confirmation: straight to "Sem grupo".
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(outline()).toEqual([
      "# Grupo 11",
      "Ângela Dias",
      "# Grupo 21",
      "Carlos Reis",
      "# Grupo 30",
      "Arraste um discente para cá.",
      "# Sem grupo2",
      "Bruno Lima",
      "Davi Sem Grupo",
    ]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/enrollments/1?depth=0");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ group: null });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it("puts the student back when the server refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
    );
    byGroup();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remover Bruno Lima do grupo" }),
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(outline().slice(2, 5)).toEqual([
      "# Grupo 22",
      "Bruno Lima",
      "Carlos Reis",
    ]);
    vi.unstubAllGlobals();
  });

  it("keeps the bin that removes from the offer in the plain list", () => {
    byGroup();
    fireEvent.click(screen.getByRole("button", { name: "Ver por alunos" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
    expect(
      screen
        .getAllByRole("button", { name: /^Remover / })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Remover Ângela Dias",
      "Remover Bruno Lima",
      "Remover Carlos Reis",
      "Remover Davi Sem Grupo",
    ]);
  });

  it("swaps the add button: students in one view, groups in the other", () => {
    byGroup();
    expect(
      screen.getByRole("button", { name: /Adicionar grupos/ }).textContent,
    ).toContain("Grupo 2,Grupo 1,Grupo 3");
    expect(
      screen.queryByRole("button", { name: /Cadastrar aluno/ }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ver por alunos" }));
    expect(
      screen.getByRole("button", { name: /Cadastrar aluno/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Adicionar grupos/ }),
    ).toBeNull();
  });

  it("lays the header out as count | view switch | grades group", () => {
    byGroup();
    const count = screen.getByText("4");
    const firstBar = count.nextElementSibling!;
    expect(firstBar.getAttribute("aria-hidden")).toBe("true");
    const viewSwitch = firstBar.nextElementSibling!;
    expect(viewSwitch.getAttribute("aria-label")).toBe("Modo de visualização");
    const secondBar = viewSwitch.nextElementSibling!;
    expect(secondBar.getAttribute("aria-hidden")).toBe("true");

    const gradesGroup = secondBar.nextElementSibling as HTMLElement;
    const toggle = within(gradesGroup).getByRole("button", {
      name: "Ver notas",
    });
    expect(
      within(gradesGroup).queryByRole("group", { name: "Formato das notas" }),
    ).toBeNull();

    // The format switch shows up to the right of the toggle, only while on.
    fireEvent.click(toggle);
    const format = within(gradesGroup).getByRole("group", {
      name: "Formato das notas",
    });
    expect(
      within(gradesGroup).getByRole("button", { name: "Ocultar notas" })
        .nextElementSibling,
    ).toBe(format);
  });

  it("removes a group once confirmed, sending its members to Sem grupo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    byGroup();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remover grupo Grupo 2" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Grupo 2");
    expect(dialog.textContent).toContain("continuam na oferta");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/student-groups/20");
    expect(init.method).toBe("DELETE");
    expect(outline().filter((line) => line?.startsWith("#"))).toEqual([
      "# Grupo 11",
      "# Grupo 30",
      "# Sem grupo3",
    ]);
    expect(router.refresh).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows everyone as ungrouped when the offer has no groups", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={students}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    expect(outline()[0]).toBe("# Sem grupo3");
  });
});

describe("rearranging groups", () => {
  const groups = [
    { id: 10, name: "Grupo 1" },
    { id: 20, name: "Grupo 2" },
  ];
  const grouped: EnrollmentRow[] = [
    { ...students[0], groupId: 20 }, // Bruno Lima
    { ...students[1], groupId: 10 }, // Ângela Dias
    { ...students[2], groupId: 20 }, // Carlos Reis
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

  function editGroups() {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={grouped}
        groups={groups}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
  }

  const zones = () =>
    Array.from(document.querySelectorAll("[data-drop-zone]")).map((el) =>
      el.getAttribute("data-drop-zone"),
    );
  const sectionTitles = () =>
    screen.getAllByRole("rowheader").map((h) => h.textContent);

  beforeEach(() => {
    router.refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("gives every student a handle to drag by, only in edit mode", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={grouped}
        groups={groups}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    expect(screen.queryByRole("button", { name: /^Mover / })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
    expect(
      screen
        .getAllByRole("button", { name: /^Mover / })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Mover Ângela Dias", "Mover Bruno Lima", "Mover Carlos Reis"]);
  });

  it("has no handles in the plain list, even in edit mode", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={grouped}
        groups={groups}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Editar tabela de discentes" }),
    );
    expect(screen.queryByRole("button", { name: /^Mover / })).toBeNull();
  });

  it("makes each group a drop zone, plus one to take a student out of any", () => {
    editGroups();
    expect(zones()).toEqual(["group:10", "group:20", "ungrouped"]);
    expect(sectionTitles().at(-1)).toBe("Sem grupo0");
    expect(screen.getByText("Arraste um discente para cá.")).toBeTruthy();
  });

  it("keeps the rows as table rows, so the table still reads as one", () => {
    editGroups();
    // header row + 2 group headers + 3 students + "Sem grupo" header + hint
    expect(screen.getAllByRole("row")).toHaveLength(8);
  });

  it("offers a pencil per group to rename it, but not for Sem grupo", () => {
    editGroups();
    expect(
      screen
        .getAllByRole("button", { name: /^Renomear grupo / })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Renomear grupo Grupo 1", "Renomear grupo Grupo 2"]);
  });

  it("renames a group in place", async () => {
    const fetchMock = mockFetch(200, { doc: { id: 20 } });
    editGroups();
    fireEvent.click(
      screen.getByRole("button", { name: "Renomear grupo Grupo 2" }),
    );
    const box = screen.getByLabelText("Nome do grupo") as HTMLInputElement;
    expect(box.value).toBe("Grupo 2");

    fireEvent.change(box, { target: { value: "  RBA   Engenharia " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByLabelText("Nome do grupo")).toBeNull(),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/student-groups/20?depth=0");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ name: "RBA Engenharia" });
    // Renamed, and re-sorted: "Grupo 1" now comes first alphabetically.
    expect(sectionTitles().slice(0, 2)).toEqual([
      "Grupo 11",
      "RBA Engenharia2",
    ]);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("refuses a name another group already has", () => {
    const fetchMock = mockFetch(200);
    editGroups();
    fireEvent.click(
      screen.getByRole("button", { name: "Renomear grupo Grupo 2" }),
    );
    fireEvent.change(screen.getByLabelText("Nome do grupo"), {
      target: { value: "grupo 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByRole("alert").textContent).toMatch(/Já existe um grupo/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes without a request when the name was not changed", () => {
    const fetchMock = mockFetch(200);
    editGroups();
    fireEvent.click(
      screen.getByRole("button", { name: "Renomear grupo Grupo 2" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.queryByLabelText("Nome do grupo")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discards a rename on Escape or Descartar", () => {
    editGroups();
    fireEvent.click(
      screen.getByRole("button", { name: "Renomear grupo Grupo 2" }),
    );
    fireEvent.change(screen.getByLabelText("Nome do grupo"), {
      target: { value: "Outro" },
    });
    fireEvent.keyDown(screen.getByLabelText("Nome do grupo"), {
      key: "Escape",
    });
    expect(sectionTitles()).toContain("Grupo 22");

    fireEvent.click(
      screen.getByRole("button", { name: "Renomear grupo Grupo 2" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(sectionTitles()).toContain("Grupo 22");
  });

  it("keeps the typed name and explains when the server refuses", async () => {
    mockFetch(400, { errors: [{ data: { errors: [{ path: "name" }] } }] });
    editGroups();
    fireEvent.click(
      screen.getByRole("button", { name: "Renomear grupo Grupo 2" }),
    );
    fireEvent.change(screen.getByLabelText("Nome do grupo"), {
      target: { value: "Alfa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Já existe um grupo chamado “Alfa”.",
    );
    expect(
      (screen.getByLabelText("Nome do grupo") as HTMLInputElement).value,
    ).toBe("Alfa");
  });
});

describe("viewing grades", () => {
  const assessments = [
    {
      id: 1,
      code: "P1",
      name: "Prova 1",
      weight: 4,
      category: "regular" as const,
      scoredBy: "student" as const,
      mode: "graded" as const,
      tasks: [],
    },
    {
      id: 2,
      code: "SEM",
      name: "Seminário",
      weight: 2.5,
      category: "regular" as const,
      scoredBy: "group" as const,
      mode: "graded" as const,
      tasks: [],
    },
  ];
  const groups = [{ id: 20, name: "Grupo 2" }];
  const enrolled: EnrollmentRow[] = [
    { ...students[0], groupId: 20 }, // Bruno Lima, id 1
    students[1], // Ângela Dias, id 2, no group
    { ...students[2], groupId: 20 }, // Carlos Reis, id 3
  ];
  const scores = [
    { id: 100, assessmentId: 1, enrollmentId: 1, percentage: 80 },
    { id: 101, assessmentId: 1, enrollmentId: 2, percentage: 55.5 },
    // The seminar is graded per group, but each member holds the grade.
    { id: 102, assessmentId: 2, enrollmentId: 1, percentage: 87 },
    { id: 103, assessmentId: 2, enrollmentId: 3, percentage: 87 },
  ];

  const gradesTable = () =>
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={enrolled}
        groups={groups}
        assessments={assessments}
        scores={scores}
      />,
    );
  const headers = () =>
    screen.getAllByRole("columnheader").map((h) => h.textContent);
  const showGrades = () => {
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em pontos" }),
    );
  };

  it("keeps the grades out of the table until asked for", () => {
    gradesTable();
    expect(headers()).toEqual(["M.", "Nome"]);
    expect(
      screen.queryByRole("group", { name: "Formato das notas" }),
    ).toBeNull();
  });

  it("adds a column per assessment, right after the name, with its weight", () => {
    gradesTable();
    showGrades();
    expect(headers()).toEqual(["M.", "Nome", "P14.0", "SEM2.5", "Total"]);
    expect(
      screen
        .getByRole("button", { name: "Ocultar notas" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows each student's points, with a dash where there is no grade", () => {
    gradesTable();
    showGrades();
    expect(bodyRows()).toEqual([
      // Ângela: 55.5% of 4.0; no group, so no seminar grade.
      ["204300051", "Ângela Dias", "2.2", "—", "2.2"],
      // Bruno: 80% of 4.0; 87% of 2.5 in the seminar.
      ["214450010", "Bruno Lima", "3.2", "2.2", "5.4"],
      // Carlos: no P1 yet; the same seminar grade as Bruno.
      ["2023011671", "Carlos Reis", "—", "2.2", "2.2"],
    ]);
  });

  it("switches between points and percentage of the assessment", () => {
    gradesTable();
    showGrades();
    const points = screen.getByRole("button", { name: "Ver notas em pontos" });
    const percent = screen.getByRole("button", {
      name: "Ver notas em porcentagem",
    });
    expect(points.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(percent);
    expect(percent.getAttribute("aria-pressed")).toBe("true");
    expect(bodyRows()).toEqual([
      ["204300051", "Ângela Dias", "55.5%", "—", "55.5%"],
      ["214450010", "Bruno Lima", "80%", "87%", "82.7%"],
      ["2023011671", "Carlos Reis", "—", "87%", "87%"],
    ]);

    fireEvent.click(points);
    expect(bodyRows()[1]).toEqual([
      "214450010",
      "Bruno Lima",
      "3.2",
      "2.2",
      "5.4",
    ]);
  });

  it("hides the columns and the format switch again", () => {
    gradesTable();
    showGrades();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar notas" }));
    expect(headers()).toEqual(["M.", "Nome"]);
    expect(
      screen.queryByRole("group", { name: "Formato das notas" }),
    ).toBeNull();
  });

  it("shows the grades in the by-group view too", () => {
    gradesTable();
    showGrades();
    fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    const rows = screen
      .getAllByRole("row")
      .map((row) =>
        within(row)
          .queryAllByRole("cell")
          .map((c) => c.textContent),
      )
      .filter((cells) => cells.length === 5);
    expect(rows).toEqual([
      ["214450010", "Bruno Lima", "3.2", "2.2", "5.4"],
      ["2023011671", "Carlos Reis", "—", "2.2", "2.2"],
      ["204300051", "Ângela Dias", "2.2", "—", "2.2"],
    ]);
  });

  it("with no assessments, the grades view shows only an empty total", () => {
    table();
    showGrades();
    expect(headers()).toEqual(["M.", "Nome", "Total"]);
    expect(bodyRows().map((r) => r[2])).toEqual(["—", "—", "—"]);
  });

  it("colours each grade against its assessment, and the total against what was handed out", () => {
    gradesTable();
    showGrades();
    const tones = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .slice(2)
          .map((c) => c.getAttribute("data-tone")),
      );
    expect(tones).toEqual([
      // Ângela: 55.5% fails; total 2.22 of the 4.0 handed out fails.
      ["fail", null, "fail"],
      // Bruno: 80% and 87% pass; so does the total.
      ["pass", "pass", "pass"],
      // Carlos: only the seminar grade, which passes.
      [null, "pass", "pass"],
    ]);

    const angela = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(angela[2].className).toContain("text-red-600");
    const bruno = within(screen.getAllByRole("row")[2]).getAllByRole("cell");
    expect(bruno[2].className).toContain("text-blue-600");
    expect(bruno[4].className).toContain("text-blue-600");
  });

  it("counts bonus points in the total, measured against the regular ones", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={[students[0]]}
        assessments={[
          assessments[0],
          {
            id: 3,
            code: "EXT",
            name: "Extra",
            weight: 1,
            category: "extra" as const,
            scoredBy: "student" as const,
            mode: "graded" as const,
            tasks: [],
          },
        ]}
        scores={[
          { id: 1, assessmentId: 1, enrollmentId: 1, percentage: 50 },
          { id: 2, assessmentId: 3, enrollmentId: 1, percentage: 100 },
        ]}
      />,
    );
    showGrades();
    // 2.0 of P1 + 1.0 bonus = 3.0, against the 4.0 handed out: 75%.
    expect(bodyRows()[0]).toEqual([
      "214450010",
      "Bruno Lima",
      "2.0",
      "1.0",
      "3.0",
    ]);
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[2].getAttribute("data-tone")).toBe("fail");
    expect(cells[4].getAttribute("data-tone")).toBe("pass");
  });

  it("separates each assessment heading with a vertical rule", () => {
    gradesTable();
    showGrades();
    expect(
      screen.getByRole("columnheader", { name: /P1/ }).className,
    ).toContain("border-l");
  });

  it("colours the heading of an extra assessment apart from the regular ones", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={[students[0]]}
        assessments={[
          assessments[0],
          {
            id: 3,
            code: "EXT",
            name: "Extra",
            weight: 1,
            category: "extra" as const,
            scoredBy: "student" as const,
            mode: "graded" as const,
            tasks: [],
          },
        ]}
      />,
    );
    showGrades();
    const regular = screen.getByText("P1");
    const extra = screen.getByText("EXT");
    expect(regular.className).toContain("text-primary");
    expect(regular.className).not.toContain("text-secondary");
    expect(extra.className).toContain("text-secondary");
    expect(extra.className).not.toContain("text-primary");
  });
});

describe("entering grades", () => {
  const assessments = [
    {
      id: 1,
      code: "P1",
      name: "Prova 1",
      weight: 4,
      category: "regular" as const,
      scoredBy: "student" as const,
      mode: "graded" as const,
      tasks: [],
    },
    {
      id: 2,
      code: "SEM",
      name: "Seminário",
      weight: 2.5,
      category: "regular" as const,
      scoredBy: "group" as const,
      mode: "graded" as const,
      tasks: [],
    },
  ];
  const groups = [
    { id: 10, name: "Grupo 1" },
    { id: 20, name: "Grupo 2" },
  ];
  // Sorted by name: Ângela (2), Bruno (1), Carlos (3).
  const enrolled: EnrollmentRow[] = [
    { ...students[0], groupId: 20 }, // Bruno Lima, id 1
    { ...students[1], groupId: 10 }, // Ângela Dias, id 2
    { ...students[2], groupId: 20 }, // Carlos Reis, id 3
  ];
  const scores = [
    {
      id: 100,
      assessmentId: 1,
      enrollmentId: 1,
      percentage: 80,
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
  ];

  function mockFetch(status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const bodies = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([url, init]) => ({
      url,
      ...JSON.parse(init.body),
    }));

  function start({ byGroup = false, percent = false } = {}) {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={enrolled}
        groups={groups}
        assessments={assessments}
        scores={scores}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em pontos" }),
    );
    if (percent) {
      fireEvent.click(
        screen.getByRole("button", { name: "Ver notas em porcentagem" }),
      );
    }
    if (byGroup) {
      fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
  }

  const cell = (label: string) => screen.getByRole("button", { name: label });
  const input = () => screen.getByRole("textbox") as HTMLInputElement;
  const type = (value: string) =>
    fireEvent.change(input(), { target: { value } });
  const press = (key: string, shiftKey = false) =>
    fireEvent.keyDown(input(), { key, shiftKey });

  beforeEach(() => {
    router.refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("offers the pencil only inside the grades view", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={enrolled}
        assessments={assessments}
        scores={scores}
      />,
    );
    expect(screen.queryByRole("button", { name: "Lançar notas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em pontos" }),
    );
    expect(screen.getByRole("button", { name: "Lançar notas" })).toBeTruthy();
    // Grades alone are not clickable.
    expect(screen.queryByRole("button", { name: /^Nota de / })).toBeNull();
  });

  it("makes every grade a cell to click, and leaves the total alone", () => {
    start();
    expect(
      screen
        .getAllByRole("button", { name: /^Nota de / })
        .map((b) => `${b.getAttribute("aria-label")}=${b.textContent}`),
    ).toEqual([
      "Nota de Ângela Dias em P1=—",
      "Nota de Ângela Dias em SEM=—",
      "Nota de Bruno Lima em P1=3.2",
      "Nota de Bruno Lima em SEM=—",
      "Nota de Carlos Reis em P1=—",
      "Nota de Carlos Reis em SEM=—",
    ]);
  });

  it("opens a cell on its current grade, in the unit on screen", () => {
    start();
    fireEvent.click(cell("Nota de Bruno Lima em P1"));
    expect(input().value).toBe("3.2");
    expect(document.activeElement).toBe(input());
    press("Escape");

    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em porcentagem" }),
    );
    fireEvent.click(cell("Nota de Bruno Lima em P1"));
    expect(input().value).toBe("80");
  });

  it("saves on Enter and moves down to the next student, same assessment", async () => {
    const fetchMock = mockFetch();
    start({ percent: true });
    fireEvent.click(cell("Nota de Ângela Dias em P1"));
    type("70");
    press("Enter");

    // Ângela's grade is on screen at once, and Bruno's cell is open.
    expect(cell("Nota de Ângela Dias em P1").textContent).toBe("70%");
    expect(input().getAttribute("aria-label")).toBe("Nota de Bruno Lima em P1");
    expect(input().value).toBe("80");

    type("90");
    press("Enter");
    expect(input().getAttribute("aria-label")).toBe(
      "Nota de Carlos Reis em P1",
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodies(fetchMock)).toEqual([
      {
        url: "/api/scores/set",
        offer: 7,
        activity: 1,
        enrollments: [2],
        // Ângela has no grade yet: nothing for the server to find.
        expected: { "2": null },
        percentage: 70,
      },
      {
        url: "/api/scores/set",
        offer: 7,
        activity: 1,
        enrollments: [1],
        // Bruno's grade came with its stamp from the server.
        expected: { "1": "2026-10-01T10:00:00.000Z" },
        percentage: 90,
      },
    ]);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("saves on Tab and moves right to the same student's next assessment", async () => {
    const fetchMock = mockFetch();
    start({ percent: true });
    fireEvent.click(cell("Nota de Ângela Dias em P1"));
    type("70");
    press("Tab");

    expect(cell("Nota de Ângela Dias em P1").textContent).toBe("70%");
    expect(input().getAttribute("aria-label")).toBe(
      "Nota de Ângela Dias em SEM",
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodies(fetchMock)[0]).toMatchObject({
      activity: 1,
      enrollments: [2],
      percentage: 70,
    });
  });

  it("goes from the end of a row to the start of the next with Tab", () => {
    mockFetch();
    start();
    fireEvent.click(cell("Nota de Ângela Dias em SEM"));
    press("Tab");
    expect(input().getAttribute("aria-label")).toBe("Nota de Bruno Lima em P1");
  });

  describe("with the arrow keys", () => {
    const label = () => input().getAttribute("aria-label");

    it("goes down and up, saving what was typed", async () => {
      const fetchMock = mockFetch();
      start({ percent: true });
      fireEvent.click(cell("Nota de Ângela Dias em P1"));
      type("70");
      press("ArrowDown");
      expect(label()).toBe("Nota de Bruno Lima em P1");
      expect(cell("Nota de Ângela Dias em P1").textContent).toBe("70%");
      press("ArrowUp");
      expect(label()).toBe("Nota de Ângela Dias em P1");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });

    it("goes right and left once the caret is at the edge", () => {
      mockFetch();
      start();
      fireEvent.click(cell("Nota de Bruno Lima em P1"));
      // Opening selects the whole text: an arrow goes to the next cell.
      press("ArrowRight");
      expect(label()).toBe("Nota de Bruno Lima em SEM");
      press("ArrowLeft");
      expect(label()).toBe("Nota de Bruno Lima em P1");
    });

    it("leaves Left and Right to the caret while it is inside the text", () => {
      mockFetch();
      start();
      fireEvent.click(cell("Nota de Bruno Lima em P1"));
      type("3,25");
      input().setSelectionRange(2, 2);
      press("ArrowLeft");
      press("ArrowRight");
      expect(label()).toBe("Nota de Bruno Lima em P1");
      input().setSelectionRange(4, 4);
      press("ArrowRight");
      expect(label()).toBe("Nota de Bruno Lima em SEM");
    });

    it("stays put where there is no cell, instead of closing", () => {
      mockFetch();
      start();
      fireEvent.click(cell("Nota de Ângela Dias em P1"));
      press("ArrowUp");
      press("ArrowLeft");
      expect(label()).toBe("Nota de Ângela Dias em P1");
    });

    it("stays on a grade that is not valid", () => {
      mockFetch();
      start({ percent: true });
      fireEvent.click(cell("Nota de Ângela Dias em P1"));
      type("120");
      press("ArrowDown");
      expect(label()).toBe("Nota de Ângela Dias em P1");
      expect(screen.getByRole("alert").textContent).toMatch(/0 a 100/);
    });
  });

  it("goes back left with Shift+Tab, and up with Shift+Enter", () => {
    mockFetch();
    start();
    fireEvent.click(cell("Nota de Bruno Lima em SEM"));
    press("Tab", true);
    expect(input().getAttribute("aria-label")).toBe("Nota de Bruno Lima em P1");
    press("Enter", true);
    expect(input().getAttribute("aria-label")).toBe(
      "Nota de Ângela Dias em P1",
    );
  });

  it("goes from the last student to the top of the next assessment", () => {
    mockFetch();
    start();
    fireEvent.click(cell("Nota de Carlos Reis em P1"));
    press("Enter");
    expect(input().getAttribute("aria-label")).toBe(
      "Nota de Ângela Dias em SEM",
    );
  });

  it("does not call the server for a grade left as it was", () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Bruno Lima em P1"));
    press("Tab");
    fireEvent.click(cell("Nota de Ângela Dias em P1"));
    press("Tab");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes points when points are on screen, and updates the total", async () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Ângela Dias em P1"));
    type("3,0");
    press("Tab");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodies(fetchMock)[0].percentage).toBe(75);
    expect(cell("Nota de Ângela Dias em P1").textContent).toBe("3.0");
    const row = cell("Nota de Ângela Dias em P1").closest("tr")!;
    expect(within(row).getAllByRole("cell").at(-1)?.textContent).toBe("3.0");
  });

  it("clears a grade when the cell is emptied", async () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Bruno Lima em P1"));
    type("");
    press("Tab");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodies(fetchMock)[0]).toMatchObject({
      enrollments: [1],
      percentage: null,
    });
    expect(cell("Nota de Bruno Lima em P1").textContent).toBe("—");
  });

  it("keeps the cell open and explains an invalid grade", () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Ângela Dias em P1"));
    type("4.5");
    press("Tab");

    expect(screen.getByRole("alert").textContent).toBe(
      "Esta avaliação vale no máximo 4.0.",
    );
    expect(input().getAttribute("aria-label")).toBe(
      "Nota de Ângela Dias em P1",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives up on Escape without saving", () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Ângela Dias em P1"));
    type("2");
    press("Escape");

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(cell("Nota de Ângela Dias em P1").textContent).toBe("—");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves when the cell is left with the mouse", async () => {
    const fetchMock = mockFetch();
    start({ percent: true });
    fireEvent.click(cell("Nota de Ângela Dias em P1"));
    type("65");
    fireEvent.blur(input());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(cell("Nota de Ângela Dias em P1").textContent).toBe("65%");
  });

  it("takes the grade back and says so when the server refuses", async () => {
    mockFetch(403);
    start({ percent: true });
    fireEvent.click(cell("Nota de Bruno Lima em P1"));
    type("10");
    press("Escape");
    fireEvent.click(cell("Nota de Bruno Lima em P1"));
    type("10");
    fireEvent.blur(input());

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(cell("Nota de Bruno Lima em P1").textContent).toBe("80%");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("stops being clickable when grade entry is switched off", () => {
    start();
    fireEvent.click(
      screen.getByRole("button", { name: "Parar de lançar notas" }),
    );
    expect(screen.queryByRole("button", { name: /^Nota de / })).toBeNull();
  });

  describe("for a group", () => {
    it("gives each group a cell under the assessments graded per group only", () => {
      start({ byGroup: true });
      expect(
        screen
          .getAllByRole("button", { name: /^Nota do grupo / })
          .map((b) => b.getAttribute("aria-label")),
      ).toEqual([
        "Nota do grupo Grupo 1 em SEM",
        "Nota do grupo Grupo 2 em SEM",
      ]);
    });

    it("gives the grade typed on the group's row to every member", async () => {
      const fetchMock = mockFetch();
      start({ byGroup: true, percent: true });
      fireEvent.click(cell("Nota do grupo Grupo 2 em SEM"));
      type("90");
      press("Enter");

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(bodies(fetchMock)[0]).toEqual({
        url: "/api/scores/set",
        offer: 7,
        activity: 2,
        // Bruno and Carlos, the two members of Grupo 2.
        enrollments: [1, 3],
        expected: { "1": null, "3": null },
        percentage: 90,
      });
      // Enter went down to the first member, whose cell opens on the new grade.
      expect(input().getAttribute("aria-label")).toBe(
        "Nota de Bruno Lima em SEM",
      );
      expect(input().value).toBe("90");
      expect(cell("Nota de Carlos Reis em SEM").textContent).toBe("90%");
      expect(cell("Nota de Ângela Dias em SEM").textContent).toBe("—");
    });

    it("lets one member be an exception, and then shows the group as mixed", async () => {
      const fetchMock = mockFetch();
      start({ byGroup: true, percent: true });
      fireEvent.click(cell("Nota do grupo Grupo 2 em SEM"));
      type("90");
      press("Escape");
      fireEvent.click(cell("Nota do grupo Grupo 2 em SEM"));
      type("90");
      fireEvent.blur(input());
      expect(cell("Nota do grupo Grupo 2 em SEM").textContent).toBe("90%");

      fireEvent.click(cell("Nota de Carlos Reis em SEM"));
      type("40");
      fireEvent.blur(input());

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(bodies(fetchMock)[1]).toMatchObject({
        enrollments: [3],
        percentage: 40,
      });
      expect(cell("Nota de Bruno Lima em SEM").textContent).toBe("90%");
      expect(cell("Nota do grupo Grupo 2 em SEM").textContent).toBe("≠");
    });

    it("keeps a student's grade when they are moved to another group", () => {
      // Bruno already holds the seminar grade his group got.
      const { rerender } = render(
        <EnrollmentTable
          offerId={7}
          offerPeriod="2026.2"
          enrollments={enrolled}
          groups={groups}
          assessments={assessments}
          scores={[
            { id: 1, assessmentId: 2, enrollmentId: 1, percentage: 90 },
            { id: 2, assessmentId: 2, enrollmentId: 3, percentage: 90 },
          ]}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Ver notas em pontos" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Ver notas em porcentagem" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
      fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
      expect(cell("Nota do grupo Grupo 2 em SEM").textContent).toBe("90%");

      // Bruno moves from Grupo 2 to Grupo 1 (Ângela's group, no grade yet).
      rerender(
        <EnrollmentTable
          offerId={7}
          offerPeriod="2026.2"
          enrollments={[
            { ...students[0], groupId: 10 },
            { ...students[1], groupId: 10 },
            { ...students[2], groupId: 20 },
          ]}
          groups={groups}
          assessments={assessments}
          scores={[
            { id: 1, assessmentId: 2, enrollmentId: 1, percentage: 90 },
            { id: 2, assessmentId: 2, enrollmentId: 3, percentage: 90 },
          ]}
        />,
      );
      expect(cell("Nota de Bruno Lima em SEM").textContent).toBe("90%");
      // His old group still shows its grade; the new one is now mixed.
      expect(cell("Nota do grupo Grupo 2 em SEM").textContent).toBe("90%");
      expect(cell("Nota do grupo Grupo 1 em SEM").textContent).toBe("≠");
      expect(cell("Nota de Ângela Dias em SEM").textContent).toBe("—");
    });

    it("turns dragging off while grades are being entered", () => {
      start({ byGroup: true });
      fireEvent.click(
        screen.getByRole("button", { name: "Editar tabela de discentes" }),
      );
      expect(screen.queryByRole("button", { name: /^Mover / })).toBeNull();
    });
  });
});

describe("ticking off the tasks of a checklist assessment", () => {
  const tasks = [
    { id: "t1", name: "Lista 1" },
    { id: "t2", name: "Lista 2" },
    { id: "t3", name: "Lista 3" },
    { id: "t4", name: "Lista 4" },
  ];
  const exercises = {
    id: 5,
    code: "EX",
    name: "Exercícios",
    weight: 2,
    category: "regular" as const,
    scoredBy: "student" as const,
    mode: "checklist" as const,
    tasks,
  };
  const groups = [{ id: 20, name: "Grupo 2" }];
  // Sorted by name: Ângela (2), Bruno (1), Carlos (3).
  const enrolled: EnrollmentRow[] = [
    { ...students[0], groupId: 20 }, // Bruno Lima, id 1
    students[1], // Ângela Dias, id 2
    { ...students[2], groupId: 20 }, // Carlos Reis, id 3
  ];
  // Bruno has done lists 1 and 2.
  const scores = [
    {
      id: 100,
      assessmentId: 5,
      enrollmentId: 1,
      percentage: 50,
      completedTaskIds: ["t1", "t2"],
    },
  ];

  function mockFetch(status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const lastBody = (fetchMock: ReturnType<typeof vi.fn>) => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url, ...JSON.parse(init.body) };
  };

  function start({
    byGroup = false,
    entering = true,
    assessment = exercises,
  }: {
    byGroup?: boolean;
    entering?: boolean;
    assessment?:
      | typeof exercises
      | (Omit<typeof exercises, "scoredBy"> & { scoredBy: "group" });
  } = {}) {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={enrolled}
        groups={groups}
        assessments={[assessment]}
        scores={scores}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em pontos" }),
    );
    if (byGroup) {
      fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    }
    if (entering) {
      fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
    }
  }
  const box = (label: string) =>
    screen.getByRole("checkbox", { name: label }) as HTMLInputElement;
  const headers = () =>
    screen.getAllByRole("columnheader").map((h) => h.textContent);

  beforeEach(() => {
    router.refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("shows the grade as the share of tasks done, like any other", () => {
    start({ entering: false });
    expect(headers()).toEqual(["M.", "Nome", "EX2.0", "Total"]);
    // Ângela none (0.0), Bruno 2 of 4 (1.0), Carlos none.
    expect(bodyRows().map((r) => r[2])).toEqual(["0.0", "1.0", "0.0"]);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("opens into one checkbox per task while grades are being entered", () => {
    start();
    expect(headers()).toEqual([
      "Nome",
      "EX2.0",
      "Total",
      "Lista 1",
      "Lista 2",
      "Lista 3",
      "Lista 4",
      "nota",
    ]);
    // The assessment's heading spans its four checkboxes and its grade.
    expect(
      screen.getByRole("columnheader", { name: /EX/ }).getAttribute("colspan"),
    ).toBe("5");
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    expect(box("Bruno Lima fez Lista 1, de EX").checked).toBe(true);
    expect(box("Bruno Lima fez Lista 3, de EX").checked).toBe(false);
    expect(box("Ângela Dias fez Lista 1, de EX").checked).toBe(false);
  });

  it("describes each assessment heading on hover", () => {
    start();
    const heading = screen.getByRole("columnheader", { name: /EX/ });
    expect(heading.getAttribute("data-tooltip")).toBe(
      "Exercícios — vale 2.0, 4 tarefa(s)",
    );
  });

  it("heads a task by its acronym and describes it on hover", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={enrolled}
        groups={groups}
        assessments={[
          {
            ...exercises,
            tasks: [
              { id: "t1", code: "L1", name: "Lista de exercícios 1" },
              { id: "t2", name: "Lista 2" },
            ],
          },
        ]}
        scores={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em pontos" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
    const coded = screen.getByRole("columnheader", { name: "L1" });
    expect(coded.getAttribute("data-tooltip")).toBe(
      "EX · Lista de exercícios 1",
    );
    // Without an acronym, the name itself heads the column.
    expect(
      screen
        .getByRole("columnheader", { name: "Lista 2" })
        .getAttribute("data-tooltip"),
    ).toBe("EX · Lista 2");
  });

  it("does not make the grade itself a cell to type in", () => {
    start();
    expect(screen.queryByRole("button", { name: /^Nota de / })).toBeNull();
  });

  it("marks a task done for that student, and the grade follows", async () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(box("Bruno Lima fez Lista 3, de EX"));

    expect(box("Bruno Lima fez Lista 3, de EX").checked).toBe(true);
    // 3 of 4 tasks: 1.5 of 2.0.
    expect(bodyRows()[1].slice(-2)).toEqual(["1.5", "1.5"]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastBody(fetchMock)).toEqual({
      url: "/api/scores/tasks",
      offer: 7,
      activity: 5,
      task: "t3",
      enrollments: [1],
      expected: { "1": null },
      done: true,
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("unmarks a task too", async () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(box("Bruno Lima fez Lista 1, de EX"));

    expect(box("Bruno Lima fez Lista 1, de EX").checked).toBe(false);
    expect(bodyRows()[1].slice(-2)).toEqual(["0.5", "0.5"]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastBody(fetchMock)).toMatchObject({ task: "t1", done: false });
  });

  it("keeps several ticks made in a row", async () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(box("Ângela Dias fez Lista 1, de EX"));
    fireEvent.click(box("Ângela Dias fez Lista 2, de EX"));
    fireEvent.click(box("Ângela Dias fez Lista 4, de EX"));

    expect(bodyRows()[0].slice(-2)).toEqual(["1.5", "1.5"]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("takes the tick back and says so when the server refuses", async () => {
    mockFetch(403);
    start();
    fireEvent.click(box("Bruno Lima fez Lista 3, de EX"));

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(box("Bruno Lima fez Lista 3, de EX").checked).toBe(false);
    expect(bodyRows()[1].slice(-2)).toEqual(["1.0", "1.0"]);
  });

  it("shows a dash while the assessment has no tasks", () => {
    start({ assessment: { ...exercises, tasks: [] } });
    expect(headers()).toEqual(["Nome", "EX2.0", "Total"]);
    expect(bodyRows().map((r) => r[1])).toEqual(["—", "—", "—"]);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  describe("graded per group", () => {
    const byGroupExercises = { ...exercises, scoredBy: "group" as const };

    it("gives the group's row a checkbox per task", () => {
      start({ byGroup: true, assessment: byGroupExercises });
      // Bruno did Lista 1 and 2; Carlos, in the same group, none.
      const first = box("Grupo Grupo 2 fez Lista 1, de EX");
      expect(first.checked).toBe(false);
      expect(first.indeterminate).toBe(true);
      const third = box("Grupo Grupo 2 fez Lista 3, de EX");
      expect(third.checked).toBe(false);
      expect(third.indeterminate).toBe(false);
    });

    it("marks a task for every member from the group's row", async () => {
      const fetchMock = mockFetch();
      start({ byGroup: true, assessment: byGroupExercises });
      fireEvent.click(box("Grupo Grupo 2 fez Lista 3, de EX"));

      expect(box("Bruno Lima fez Lista 3, de EX").checked).toBe(true);
      expect(box("Carlos Reis fez Lista 3, de EX").checked).toBe(true);
      expect(box("Grupo Grupo 2 fez Lista 3, de EX").checked).toBe(true);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(lastBody(fetchMock)).toMatchObject({
        task: "t3",
        enrollments: [1, 3],
        done: true,
      });
    });

    it("completes a task only part of the group had done", async () => {
      const fetchMock = mockFetch();
      start({ byGroup: true, assessment: byGroupExercises });
      fireEvent.click(box("Grupo Grupo 2 fez Lista 1, de EX"));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      // Only Carlos was missing it.
      expect(lastBody(fetchMock)).toMatchObject({
        task: "t1",
        enrollments: [3],
        done: true,
      });
      expect(box("Grupo Grupo 2 fez Lista 1, de EX").indeterminate).toBe(false);
    });

    it("has no group checkbox for an assessment graded per student", () => {
      start({ byGroup: true });
      expect(screen.queryByRole("checkbox", { name: /^Grupo / })).toBeNull();
      expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    });
  });
});

describe("marking the questions of a questions assessment", () => {
  const questions = [
    { id: "q1", code: "Q1", name: "Primeira questão", weight: 1 },
    { id: "q2", name: "Segunda questão", weight: 3 },
  ];
  const exam = {
    id: 6,
    code: "PR",
    name: "Prova",
    weight: 4,
    category: "regular" as const,
    scoredBy: "student" as const,
    mode: "questions" as const,
    tasks: [],
    questions,
  };
  const groups = [{ id: 20, name: "Grupo 2" }];
  // Sorted by name: Ângela, Bruno, Carlos.
  const enrolled: EnrollmentRow[] = [
    { ...students[0], groupId: 20 }, // Bruno Lima, id 1
    students[1], // Ângela Dias, id 2
    { ...students[2], groupId: 20 }, // Carlos Reis, id 3
  ];
  // Bruno: 100% in Q1, 50% in Q2 → (1·100 + 3·50) / 4 = 62.5% of 4.0 = 2.5.
  const scores = [
    {
      id: 100,
      assessmentId: 6,
      enrollmentId: 1,
      percentage: 0,
      questionPercentages: { q1: 100, q2: 50 },
    },
  ];

  function mockFetch(status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const lastBody = (fetchMock: ReturnType<typeof vi.fn>) => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url, ...JSON.parse(init.body) };
  };

  function start({
    byGroup = false,
    entering = true,
    assessment = exam as AssessmentRow,
  }: {
    byGroup?: boolean;
    entering?: boolean;
    assessment?: AssessmentRow;
  } = {}) {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={enrolled}
        groups={groups}
        assessments={[assessment]}
        scores={scores}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em pontos" }),
    );
    if (byGroup) {
      fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    }
    if (entering) {
      fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
    }
  }
  const headers = () =>
    screen.getAllByRole("columnheader").map((h) => h.textContent);
  const cell = (label: string) =>
    screen.getByRole("button", { name: label }) as HTMLButtonElement;

  beforeEach(() => {
    router.refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("shows the weighted average as the grade", () => {
    start({ entering: false });
    expect(headers()).toEqual(["M.", "Nome", "PR4.0", "Total"]);
    // Ângela has no marks (0.0), Bruno 2.5, Carlos none.
    expect(bodyRows().map((r) => r[2])).toEqual(["0.0", "2.5", "0.0"]);
    expect(screen.queryByRole("button", { name: /^Nota de/ })).toBeNull();
  });

  it("opens into one column per question while grades are entered", () => {
    start();
    expect(headers()).toEqual([
      "Nome",
      "PR4.0",
      "Total",
      "Q1",
      "Segunda questão",
      "nota",
    ]);
    expect(
      screen.getByRole("columnheader", { name: /PR/ }).getAttribute("colspan"),
    ).toBe("3");
    expect(
      screen
        .getByRole("columnheader", { name: "Segunda questão" })
        .getAttribute("data-tooltip"),
    ).toBe("PR · Segunda questão (peso 3)");
    // Bruno's marks, as percentages; the grade itself is not typed.
    expect(
      cell("Nota de Bruno Lima em Primeira questão, de PR").textContent,
    ).toBe("100%");
    expect(
      cell("Nota de Bruno Lima em Segunda questão, de PR").textContent,
    ).toBe("50%");
    expect(
      cell("Nota de Ângela Dias em Primeira questão, de PR").textContent,
    ).toBe("—");
    expect(
      screen.queryByRole("button", { name: "Nota de Bruno Lima em PR" }),
    ).toBeNull();
  });

  it("saves a typed mark and updates the grade at once", async () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Ângela Dias em Segunda questão, de PR"));
    const input = screen.getByRole("textbox", {
      name: "Nota de Ângela Dias em Segunda questão, de PR",
    });
    fireEvent.change(input, { target: { value: "80" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // 3·80 / 4 = 60% of 4.0 = 2.4
    expect(bodyRows()[0].slice(-2)).toEqual(["2.4", "2.4"]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastBody(fetchMock)).toMatchObject({
      url: expect.stringContaining("/api/scores/questions"),
      activity: 6,
      question: "q2",
      enrollments: [2],
      percentage: 80,
    });
  });

  it("refuses a mark above 100%", () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Ângela Dias em Primeira questão, de PR"));
    const input = screen.getByRole("textbox", {
      name: "Nota de Ângela Dias em Primeira questão, de PR",
    });
    fireEvent.change(input, { target: { value: "120" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("alert").textContent).toMatch(/0 a 100/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes the mark back and says so when the server refuses", async () => {
    mockFetch(403);
    start();
    fireEvent.click(cell("Nota de Bruno Lima em Segunda questão, de PR"));
    const input = screen.getByRole("textbox", {
      name: "Nota de Bruno Lima em Segunda questão, de PR",
    });
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(
      cell("Nota de Bruno Lima em Segunda questão, de PR").textContent,
    ).toBe("50%");
    expect(bodyRows()[1].slice(-2)).toEqual(["2.5", "2.5"]);
  });

  it("clears a mark when the cell is left blank", async () => {
    const fetchMock = mockFetch();
    start();
    fireEvent.click(cell("Nota de Bruno Lima em Primeira questão, de PR"));
    const input = screen.getByRole("textbox", {
      name: "Nota de Bruno Lima em Primeira questão, de PR",
    });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastBody(fetchMock)).toMatchObject({
      question: "q1",
      enrollments: [1],
      percentage: null,
    });
    // Only Q2 is left: 3·50 / 4 = 37.5% of 4.0 = 1.5.
    expect(bodyRows()[1].slice(-2)).toEqual(["1.5", "1.5"]);
  });

  it("shows a dash while the assessment has no questions", () => {
    start({ assessment: { ...exam, questions: [] } });
    expect(headers()).toEqual(["Nome", "PR4.0", "Total"]);
    expect(bodyRows().map((r) => r[1])).toEqual(["—", "—", "—"]);
  });

  it("gives the group's row a cell per question, set for every member", async () => {
    const fetchMock = mockFetch();
    start({
      byGroup: true,
      assessment: { ...exam, scoredBy: "group" as const },
    });
    // Bruno 100%, Carlos none: the members differ.
    expect(
      cell("Nota do grupo Grupo 2 em Primeira questão, de PR").textContent,
    ).toBe("≠");
    fireEvent.click(cell("Nota do grupo Grupo 2 em Primeira questão, de PR"));
    const input = screen.getByRole("textbox", {
      name: "Nota do grupo Grupo 2 em Primeira questão, de PR",
    });
    fireEvent.change(input, { target: { value: "70" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // The members hold different marks: replacing them needs a yes.
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Substituir" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastBody(fetchMock)).toMatchObject({
      question: "q1",
      enrollments: [1, 3],
      percentage: 70,
    });
  });
});

describe("the compact identity columns", () => {
  it("heads turma and matrícula by initial, with the full name on hover", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={[{ ...students[0], classGroup: "A" }, students[1]]}
      />,
    );
    const turma = screen.getByRole("columnheader", { name: /T\./ });
    expect(turma.getAttribute("data-tooltip")).toBe("Turma");
    const matricula = screen.getByRole("columnheader", { name: /M\./ });
    expect(matricula.getAttribute("data-tooltip")).toBe("Matrícula");
    // Sorting keeps its full, spoken name.
    expect(
      screen.getByRole("button", { name: "Ordenar por matrícula" }),
    ).toBeTruthy();
  });
});

describe("the grade display", () => {
  it("starts as a percentage of each assessment", () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={students}
        assessments={[
          {
            id: 1,
            code: "P1",
            name: "Prova",
            weight: 4,
            category: "regular",
            scoredBy: "student",
            mode: "graded",
            tasks: [],
          },
        ]}
        scores={[{ id: 1, assessmentId: 1, enrollmentId: 1, percentage: 80 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    expect(
      screen
        .getByRole("button", { name: "Ver notas em porcentagem" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(bodyRows().map((r) => r[2])).toContain("80%");
  });
});

describe("saving grades safely", () => {
  const assessments: AssessmentRow[] = [
    {
      id: 1,
      code: "P1",
      name: "Prova",
      weight: 4,
      category: "regular",
      scoredBy: "student",
      mode: "graded",
      tasks: [],
    },
    {
      id: 2,
      code: "SEM",
      name: "Seminário",
      weight: 2,
      category: "regular",
      scoredBy: "group",
      mode: "graded",
      tasks: [],
    },
  ];
  const groups = [{ id: 20, name: "Grupo 2" }];
  const enrolled: EnrollmentRow[] = [
    { ...students[0], groupId: 20 }, // Bruno, id 1
    students[1], // Ângela, id 2
    { ...students[2], groupId: 20 }, // Carlos, id 3
  ];
  const scores = [
    {
      id: 1,
      assessmentId: 1,
      enrollmentId: 1,
      percentage: 80,
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
    { id: 2, assessmentId: 2, enrollmentId: 1, percentage: 50 },
    { id: 3, assessmentId: 2, enrollmentId: 3, percentage: 90 },
  ];

  function mockFetch(
    status = 200,
    json: unknown = { stamps: { "2": "2026-10-14T12:00:00.000Z" } },
  ) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  function start(byGroup = false) {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={enrolled}
        groups={groups}
        assessments={assessments}
        scores={scores}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver notas em porcentagem" }),
    );
    if (byGroup) {
      fireEvent.click(screen.getByRole("button", { name: "Ver por grupos" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
  }
  const typeInto = (label: string, value: string, key = "Enter") => {
    fireEvent.click(screen.getByRole("button", { name: label }));
    const field = screen.getByRole("textbox", { name: label });
    fireEvent.change(field, { target: { value } });
    fireEvent.keyDown(field, { key });
  };

  beforeEach(() => {
    router.refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("sends the stamp it saw, and the next change uses the one it got back", async () => {
    const fetchMock = mockFetch();
    start();
    typeInto("Nota de Ângela Dias em P1", "70");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    typeInto("Nota de Ângela Dias em P1", "75");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const sent = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(sent[0].expected).toEqual({ "2": null });
    expect(sent[1].expected).toEqual({ "2": "2026-10-14T12:00:00.000Z" });
  });

  it("takes the grade back and explains when someone else changed it", async () => {
    mockFetch(409, { error: "x" });
    start();
    typeInto("Nota de Bruno Lima em P1", "10");

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /alterada em outro lugar/,
    );
    expect(
      screen.getByRole("button", { name: "Nota de Bruno Lima em P1" })
        .textContent,
    ).toBe("80%");
    // The table reloads, to show what is there now.
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("says the session ended, and which grade was not saved", async () => {
    mockFetch(401, {});
    start();
    typeInto("Nota de Ângela Dias em P1", "70");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/sessão expirou/);
    expect(alert.textContent).toMatch(/a nota de P1 não foi salvo/);
  });

  it("does not even try without a connection", async () => {
    const fetchMock = mockFetch();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    start();
    typeInto("Nota de Ângela Dias em P1", "70");

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Sem conexão/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Nota de Ângela Dias em P1" })
        .textContent,
    ).toBe("—");
    vi.restoreAllMocks();
  });

  it("shows that it is saving while the request is out", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      ),
    );
    start();
    typeInto("Nota de Ângela Dias em P1", "70");
    expect(await screen.findByText(/Salvando/)).toBeTruthy();
    finish({ ok: true, status: 200, json: async () => ({}) });
    await waitFor(() => expect(screen.queryByText(/Salvando/)).toBeNull());
  });

  describe("a group's grade over different member grades", () => {
    it("asks before replacing them, and sends nothing on Cancelar", () => {
      const fetchMock = mockFetch();
      start(true);
      expect(
        screen.getByRole("button", { name: "Nota do grupo Grupo 2 em SEM" })
          .textContent,
      ).toBe("≠");
      typeInto("Nota do grupo Grupo 2 em SEM", "100");

      expect(screen.getByText(/notas diferentes em SEM/)).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(fetchMock).not.toHaveBeenCalled();
      // Nothing shown changed either.
      expect(
        screen.getByRole("button", { name: "Nota de Bruno Lima em SEM" })
          .textContent,
      ).toBe("50%");
    });

    it("replaces them on Substituir", async () => {
      const fetchMock = mockFetch();
      start(true);
      typeInto("Nota do grupo Grupo 2 em SEM", "100");
      fireEvent.click(screen.getByRole("button", { name: "Substituir" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        enrollments: [1, 3],
        percentage: 100,
      });
    });
  });

  describe("on a touch screen", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((query: string) => ({
          matches: query.includes("pointer: coarse"),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
    });

    it("does not save when the cell is left, only on ✓", async () => {
      const fetchMock = mockFetch();
      start();
      fireEvent.click(
        screen.getByRole("button", { name: "Nota de Ângela Dias em P1" }),
      );
      const field = screen.getByRole("textbox", {
        name: "Nota de Ângela Dias em P1",
      });
      fireEvent.change(field, { target: { value: "70" } });
      fireEvent.blur(field);
      expect(fetchMock).not.toHaveBeenCalled();
      // Still open, waiting for a decision.
      expect(
        screen.getByRole("textbox", { name: "Nota de Ângela Dias em P1" }),
      ).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Confirmar nota" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).percentage).toBe(70);
    });

    it("gives up on ✕, keeping the grade it had", () => {
      const fetchMock = mockFetch();
      start();
      fireEvent.click(
        screen.getByRole("button", { name: "Nota de Bruno Lima em P1" }),
      );
      const field = screen.getByRole("textbox", {
        name: "Nota de Bruno Lima em P1",
      });
      fireEvent.change(field, { target: { value: "5" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Cancelar edição da nota" }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Nota de Bruno Lima em P1" })
          .textContent,
      ).toBe("80%");
    });

    it("names what is being graded on the box, by acronym", () => {
      start();
      fireEvent.click(
        screen.getByRole("button", { name: "Nota de Ângela Dias em P1" }),
      );
      expect(document.querySelector("[data-grade-tag]")?.textContent).toBe(
        "P1",
      );
    });

    it("opens the box wider than the column, so the typing can be seen", () => {
      start();
      fireEvent.click(
        screen.getByRole("button", { name: "Nota de Ângela Dias em P1" }),
      );
      const box = screen
        .getByRole("textbox", { name: "Nota de Ângela Dias em P1" })
        .closest("span");
      expect(box?.className).toMatch(/\babsolute\b/);
      expect(box?.className).toMatch(/\bw-36\b/);
    });

    it("hints the keyboard's Enter key as 'next'", () => {
      start();
      fireEvent.click(
        screen.getByRole("button", { name: "Nota de Ângela Dias em P1" }),
      );
      expect(
        screen
          .getByRole("textbox", { name: "Nota de Ângela Dias em P1" })
          .getAttribute("enterkeyhint"),
      ).toBe("next");
    });

    it("says an invalid grade above the table too", () => {
      start();
      typeInto("Nota de Ângela Dias em P1", "120", "Enter");
      // The balloon is replaced by a message that cannot be cut off.
      expect(screen.getByRole("alert").textContent).toMatch(/0 a 100/);
    });
  });
});

describe("the identity columns and the heading", () => {
  // Earlier suites stub `matchMedia` for a touch screen.
  beforeEach(() => vi.unstubAllGlobals());
  const assessments: AssessmentRow[] = [
    {
      id: 1,
      code: "P1",
      name: "Prova",
      weight: 4,
      category: "regular",
      scoredBy: "student",
      mode: "graded",
      tasks: [],
    },
  ];
  const draw = () =>
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={[{ ...students[0], classGroup: "A" }, students[1]]}
        assessments={assessments}
      />,
    );
  const headers = () =>
    screen.getAllByRole("columnheader").map((h) => h.textContent);

  it("drops turma and matrícula while grades are being entered", () => {
    draw();
    expect(headers()).toEqual(["T.", "M.", "Nome"]);
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    expect(headers().slice(0, 3)).toEqual(["T.", "M.", "Nome"]);

    fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
    expect(headers()[0]).toBe("Nome");
    expect(headers()).not.toContain("T.");
    expect(headers()).not.toContain("M.");

    fireEvent.click(
      screen.getByRole("button", { name: "Parar de lançar notas" }),
    );
    expect(headers().slice(0, 3)).toEqual(["T.", "M.", "Nome"]);
  });

  it("drops them on a narrow screen too", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    draw();
    expect(headers()).toEqual(["Nome"]);
    vi.unstubAllGlobals();
  });

  it("keeps the heading in view while the rows scroll", () => {
    draw();
    const head = screen.getAllByRole("rowgroup")[0];
    expect(head.tagName).toBe("THEAD");
    expect(head.className).toMatch(/\bsticky\b/);
    expect(head.className).toMatch(/\btop-0\b/);
    // The table scrolls in its own box: sticky has nothing to stick to
    // inside an unbounded one.
    expect(head.closest("div")?.className).toMatch(/max-h-/);
  });
});

describe("what a heading abbreviates, on a touch screen", () => {
  const assessments: AssessmentRow[] = [
    {
      id: 1,
      code: "P1",
      name: "Prova Prática",
      weight: 4,
      category: "regular",
      scoredBy: "student",
      mode: "graded",
      tasks: [],
      dueDate: "2026-10-08",
      comment: "Com consulta ao material.",
    },
    {
      id: 2,
      code: "BN",
      name: "Bônus de participação",
      weight: 1,
      category: "extra",
      scoredBy: "group",
      mode: "questions",
      tasks: [],
      questions: [
        { id: "q1", code: "Q1", name: "Primeira questão", weight: 2 },
      ],
    },
  ];
  const draw = () => {
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={students}
        assessments={assessments}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
  };
  const touch = (coarse: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: coarse
          ? query.includes("pointer: coarse") || query.includes("min-width")
          : query.includes("min-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

  beforeEach(() => vi.unstubAllGlobals());

  it("opens the assessment's details on a tap of its heading", () => {
    touch(true);
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Detalhes de P1" }));
    const text = document.body.textContent ?? "";
    expect(text).toContain("Prova Prática");
    expect(text).toContain("Vale 4.0");
    expect(text).toContain("08/10/2026");
    expect(text).toContain("Com consulta ao material.");
  });

  it("opens a question's heading too, while grades are entered", () => {
    touch(true);
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Detalhes de Primeira questão" }),
    );
    expect(document.body.textContent).toContain("peso 2");
    expect(document.body.textContent).toContain("Bônus de participação");
  });

  it("lists every assessment in the legend", () => {
    touch(true);
    draw();
    fireEvent.click(
      screen.getByRole("button", { name: "Legenda das avaliações" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Prova Prática");
    expect(dialog.textContent).toContain("Bônus de participação");
    expect(dialog.textContent).toContain("Extra");
  });

  it("leaves the mouse screens as they were", () => {
    touch(false);
    draw();
    expect(screen.queryByRole("button", { name: "Detalhes de P1" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Legenda das avaliações" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("columnheader", { name: /P1/ })
        .getAttribute("data-tooltip"),
    ).toMatch(/Prova Prática/);
  });
});

describe("naming the question on the edit box, on a touch screen", () => {
  it("shows the assessment and question acronyms", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches:
          query.includes("pointer: coarse") || query.includes("min-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={students}
        assessments={[
          {
            id: 6,
            code: "PR",
            name: "Prova",
            weight: 4,
            category: "regular",
            scoredBy: "student",
            mode: "questions",
            tasks: [],
            questions: [
              { id: "q1", code: "Q1", name: "Primeira", weight: 1 },
              { id: "q2", name: "Segunda questão", weight: 1 },
            ],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Nota de Ângela Dias em Primeira, de PR",
      }),
    );
    expect(document.querySelector("[data-grade-tag]")?.textContent).toBe(
      "PR · Q1",
    );
    // Without an acronym, the question's name stands in.
    fireEvent.keyDown(
      screen.getByRole("textbox", {
        name: "Nota de Ângela Dias em Primeira, de PR",
      }),
      { key: "Escape" },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Nota de Ângela Dias em Segunda questão, de PR",
      }),
    );
    expect(document.querySelector("[data-grade-tag]")?.textContent).toBe(
      "PR · Segunda questão",
    );
    vi.unstubAllGlobals();
  });
});

describe("arrow keys over task checkboxes", () => {
  const assessments: AssessmentRow[] = [
    {
      id: 1,
      code: "P1",
      name: "Prova",
      weight: 4,
      category: "regular",
      scoredBy: "student",
      mode: "graded",
      tasks: [],
    },
    {
      id: 5,
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
    },
  ];
  // Sorted by name: Ângela, Bruno, Carlos.
  const draw = () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    render(
      <EnrollmentTable
        offerId={7}
        offerPeriod="2026.2"
        enrollments={students}
        assessments={assessments}
        scores={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver notas" }));
    fireEvent.click(screen.getByRole("button", { name: "Lançar notas" }));
  };
  const box = (label: string) =>
    screen.getByRole("checkbox", { name: label }) as HTMLInputElement;
  const focused = () => document.activeElement?.getAttribute("aria-label");

  it("moves from checkbox to checkbox, across and down", async () => {
    draw();
    const first = box("Ângela Dias fez Lista 1, de EX");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    await waitFor(() =>
      expect(focused()).toBe("Ângela Dias fez Lista 2, de EX"),
    );

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() =>
      expect(focused()).toBe("Bruno Lima fez Lista 2, de EX"),
    );

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    await waitFor(() =>
      expect(focused()).toBe("Bruno Lima fez Lista 1, de EX"),
    );

    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    await waitFor(() =>
      expect(focused()).toBe("Ângela Dias fez Lista 1, de EX"),
    );
  });

  it("goes from a number to the checkbox beside it, and back", async () => {
    draw();
    fireEvent.click(
      screen.getByRole("button", { name: "Nota de Ângela Dias em P1" }),
    );
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Nota de Ângela Dias em P1" }),
      { key: "ArrowRight" },
    );
    await waitFor(() =>
      expect(focused()).toBe("Ângela Dias fez Lista 1, de EX"),
    );
    // The number's input has closed.
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(
      screen
        .getByRole("textbox", { name: "Nota de Ângela Dias em P1" })
        .getAttribute("aria-label"),
    ).toBe("Nota de Ângela Dias em P1");
  });

  it("stays put at the last cell, and leaves Shift+arrows alone", () => {
    draw();
    const last = box("Carlos Reis fez Lista 2, de EX");
    last.focus();
    fireEvent.keyDown(last, { key: "ArrowDown" });
    fireEvent.keyDown(last, { key: "ArrowRight" });
    expect(document.activeElement).toBe(last);
    // Shift with an arrow is not ours.
    fireEvent.keyDown(last, { key: "ArrowUp", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
