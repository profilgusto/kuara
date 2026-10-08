/**
 * GroupsModal.test.tsx — the two ways of creating an offer's work groups.
 *
 * The draw itself happens on the server; here it is the preview, what is
 * sent, and what the modal does with each answer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { GroupsModal } from "./GroupsModal";
import type { EnrollmentRow } from "@/lib/enrollment";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const student = (
  id: number,
  classGroup: "A" | "B" | null = null,
  groupId: number | null = null,
): EnrollmentRow => ({
  id,
  registration: String(1000 + id),
  name: `Aluno ${id}`,
  classGroup,
  groupId,
});

/** 9 in turma A, 7 in turma B, none in a group. */
const splitClass = [
  ...Array.from({ length: 9 }, (_, i) => student(i + 1, "A")),
  ...Array.from({ length: 7 }, (_, i) => student(i + 101, "B")),
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

function openModal(
  enrollments: EnrollmentRow[] = splitClass,
  groups: { id: number; name: string }[] = [],
) {
  render(
    <GroupsModal
      offerId={7}
      offerPeriod="2026.2"
      enrollments={enrollments}
      groups={groups}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Adicionar grupos" }));
  return screen.getByRole("dialog");
}

const preview = () => screen.getByTestId("draw-preview").textContent;
const setSize = (value: string) =>
  fireEvent.change(screen.getByLabelText("Discentes por grupo"), {
    target: { value },
  });
const draw = () =>
  fireEvent.click(screen.getByRole("button", { name: "Sortear grupos" }));

beforeEach(() => {
  router.refresh.mockClear();
  vi.unstubAllGlobals();
});

describe("the modal", () => {
  it("opens with both sections and the offer it is for", () => {
    const dialog = openModal();
    expect(within(dialog).getByText("2026.2")).toBeTruthy();
    expect(screen.getByText("Sortear grupos", { selector: "h3" })).toBeTruthy();
    expect(screen.getByText("Criar um grupo manualmente")).toBeTruthy();
  });
});

describe("drawing groups", () => {
  it("previews how many groups the draw will make", () => {
    openModal();
    expect(preview()).toBe("16 discentes sem grupo → 4 grupos: 4 de 4");
    setSize("3");
    expect(preview()).toBe(
      "16 discentes sem grupo → 5 grupos: 1 de 4 e 4 de 3",
    );
  });

  it("previews each subturma on its own when drawing inside them", () => {
    openModal();
    setSize("3");
    fireEvent.click(screen.getByLabelText("Dentro de cada subturma"));
    // A: 9 → 3 groups of 3. B: 7 → 2 groups, of 4 and 3.
    expect(preview()).toBe(
      "16 discentes sem grupo → 5 grupos: 1 de 4 e 4 de 3",
    );
    setSize("5");
    // A: 9 → 2 groups (5, 4). B: 7 → 1 group of 7.
    expect(preview()).toBe(
      "16 discentes sem grupo → 3 grupos: 1 de 7 e 1 de 5 e 1 de 4",
    );
  });

  it("only counts the students who are in no group yet", () => {
    openModal([student(1), student(2), student(3, null, 50), student(4)]);
    setSize("2");
    expect(preview()).toBe("3 discentes sem grupo → 2 grupos: 1 de 2 e 1 de 1");
  });

  it("asks the server for the draw, then closes to show the result", async () => {
    const fetchMock = mockFetch(200, { groups: 5, students: 16 });
    openModal();
    setSize("3");
    fireEvent.click(screen.getByLabelText("Dentro de cada subturma"));
    draw();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/student-groups/draw");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({
      offer: 7,
      size: 3,
      scope: "classGroup",
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("draws among the whole class by default", async () => {
    const fetchMock = mockFetch(200, { groups: 4, students: 16 });
    openModal();
    draw();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      offer: 7,
      size: 4,
      scope: "all",
    });
  });

  it("refuses a missing size without calling the server", () => {
    const fetchMock = mockFetch(200);
    openModal();
    setSize("");
    draw();
    expect(screen.getByRole("alert").textContent).toMatch(/quantos discentes/);
    setSize("0");
    draw();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("has nothing to draw when everyone already has a group", () => {
    openModal([student(1, null, 50), student(2, null, 51)]);
    expect(preview()).toBe(
      "Todos os discentes desta oferta já estão em algum grupo.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Sortear grupos",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("explains that there are no subturmas to draw inside of", () => {
    openModal([student(1), student(2), student(3)]);
    fireEvent.click(screen.getByLabelText("Dentro de cada subturma"));
    expect(screen.getByText(/não tem subturmas A\/B/)).toBeTruthy();
  });

  it("stays open and explains when the server refuses", async () => {
    mockFetch(403, { error: "Acesso negado." });
    openModal();
    draw();
    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("creating a group by name", () => {
  const nameBox = () =>
    screen.getByLabelText("Nome do grupo") as HTMLInputElement;
  const insert = (name: string) => {
    fireEvent.change(nameBox(), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: "Inserir" }));
  };

  it("creates an empty group and clears the field for the next one", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    openModal();
    insert("  RBA   Engenharia ");

    expect((await screen.findByRole("status")).textContent).toBe(
      "Grupo criado: RBA Engenharia.",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/student-groups?depth=0");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "RBA Engenharia", offer: 7 });
    expect(nameBox().value).toBe("");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps the cursor in the field, ready for the next name", async () => {
    mockFetch(201, { doc: { id: 9 } });
    openModal();
    nameBox().focus();
    fireEvent.change(nameBox(), { target: { value: "Alfa" } });
    fireEvent.submit(nameBox().closest("form")!);
    // Never disabled, not even while saving: that would drop the focus.
    expect(nameBox().disabled).toBe(false);

    await screen.findByText("Grupo criado: Alfa.");
    expect(document.activeElement).toBe(nameBox());
    expect(nameBox().disabled).toBe(false);
  });

  it("lets several groups be created one after the other", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    openModal();
    insert("Alfa");
    await screen.findByText("Grupo criado: Alfa.");
    insert("Beta");

    expect(
      (await screen.findByText("Grupos criados: Alfa, Beta.")).textContent,
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses an empty name without calling the server", () => {
    const fetchMock = mockFetch(201);
    openModal();
    insert("   ");
    expect(screen.getByRole("alert").textContent).toBe(
      "Informe o nome do grupo.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a name already in the offer, or just created here", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    openModal(splitClass, [{ id: 1, name: "Grupo 1" }]);
    insert("grupo 1");
    expect(screen.getByRole("alert").textContent).toBe(
      "Já existe um grupo chamado “grupo 1”.",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    insert("Alfa");
    await screen.findByText("Grupo criado: Alfa.");
    insert("ALFA");
    expect(screen.getByRole("alert").textContent).toMatch(/Já existe um grupo/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a duplicate caught only by the server, keeping the name", async () => {
    mockFetch(400, { errors: [{ data: { errors: [{ path: "name" }] } }] });
    openModal();
    insert("Alfa");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Já existe um grupo chamado “Alfa”.",
    );
    expect(nameBox().value).toBe("Alfa");
  });
});
