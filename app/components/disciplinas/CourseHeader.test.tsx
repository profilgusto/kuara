/**
 * CourseHeader.test.tsx — the course header and its in-place edit boxes.
 *
 * Edit mode itself (who may turn it on, and where) is covered in
 * layout/EditModeContext.test.tsx; here it is just on or off.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CourseHeader, type CourseHeaderData } from "./CourseHeader";

const router = { push: vi.fn(), refresh: vi.fn() };
let editing = false;
let role: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const useEditablePage = vi.fn((enabled: boolean = true) => enabled && editing);
vi.mock("@/components/layout/EditModeContext", () => ({
  useEditablePage: (enabled?: boolean) => useEditablePage(enabled),
}));

vi.mock("@/components/layout/SessionContext", () => ({
  useSession: () => ({
    session: role ? { id: 1, name: "A", email: "a@x", role } : null,
  }),
}));

const course: CourseHeaderData = {
  id: 3,
  title: "Introdução à Engenharia Mecatrônica",
  code: "EMT0020",
  summary: "Formação, profissão e áreas de atuação.",
  workload: { theoretical: 30, practical: 0 },
};

const valueOf = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;

function mockFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  editing = false;
  role = null;
  router.refresh.mockClear();
  vi.unstubAllGlobals();
});

describe("outside edit mode", () => {
  it("shows the course as plain text, with nothing to click", () => {
    render(<CourseHeader course={course} />);

    expect(
      screen.getByRole("heading", { level: 1, name: course.title }),
    ).toBeTruthy();
    expect(screen.getByText("EMT0020")).toBeTruthy();
    expect(screen.getByText("30h teórica")).toBeTruthy();
    expect(screen.getByText(course.summary!)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("leaves out an empty workload and summary", () => {
    render(
      <CourseHeader
        course={{ ...course, summary: null, workload: { practical: 0 } }}
      />,
    );

    expect(screen.queryByText(/Sem carga horária/)).toBeNull();
    expect(screen.queryByText(/Sem descrição/)).toBeNull();
    expect(screen.queryByText(/h teórica|h prática/)).toBeNull();
  });
});

describe("read-only header", () => {
  it("does not offer itself for editing, even with edit mode on", () => {
    editing = true;
    render(<CourseHeader course={course} editable={false} />);

    expect(useEditablePage).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: course.title }),
    ).toBeTruthy();
  });

  it("is editable unless told otherwise", () => {
    render(<CourseHeader course={course} />);
    expect(useEditablePage).toHaveBeenLastCalledWith(true);
  });
});

describe("section link", () => {
  const ofertas = {
    label: "Ofertas",
    href: "/disciplinas/automacao/ofertas",
    adminOnly: true,
  };

  it("is absent when the page passes none", () => {
    role = "admin";
    render(<CourseHeader course={course} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows an admin-only link to an admin", () => {
    role = "admin";
    render(<CourseHeader course={course} sectionLink={ofertas} />);
    const link = screen.getByRole("link", { name: "Ofertas" });
    expect(link.getAttribute("href")).toBe("/disciplinas/automacao/ofertas");
  });

  it.each([null, "student", "professor"])(
    "hides an admin-only link from the role %j",
    (current) => {
      role = current;
      render(<CourseHeader course={course} sectionLink={ofertas} />);
      expect(screen.queryByRole("link")).toBeNull();
    },
  );

  it("shows a link that is not admin-only to anyone", () => {
    render(
      <CourseHeader
        course={course}
        sectionLink={{ label: "Módulos", href: "/disciplinas/automacao" }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Módulos" }).getAttribute("href"),
    ).toBe("/disciplinas/automacao");
  });

  it("steps aside while the title is being edited", () => {
    role = "admin";
    editing = true;
    render(<CourseHeader course={course} sectionLink={ofertas} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar nome da disciplina" }),
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("in edit mode", () => {
  beforeEach(() => {
    editing = true;
  });

  it("puts a pencil next to each of the four fields", () => {
    render(<CourseHeader course={course} />);

    for (const name of [
      "Editar nome da disciplina",
      "Editar código",
      "Editar carga horária",
      "Editar descrição",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("offers empty fields for editing too", () => {
    render(<CourseHeader course={{ ...course, summary: "", workload: {} }} />);

    expect(screen.getByText("Sem carga horária")).toBeTruthy();
    expect(screen.getByText("Sem descrição")).toBeTruthy();
  });

  it("turns the title into an edit box holding the current value", () => {
    render(<CourseHeader course={course} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar nome da disciplina" }),
    );

    expect(valueOf("Nome da disciplina")).toBe(course.title);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Descartar alterações" }),
    ).toBeTruthy();
  });

  it("discards without calling the server", () => {
    const fetchMock = mockFetch(200);
    render(<CourseHeader course={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar código" }));
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "OUTRO" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );

    expect(screen.getByText("EMT0020")).toBeTruthy();
    expect(screen.queryByText("OUTRO")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    // Reopening starts from the saved value, not the discarded text.
    fireEvent.click(screen.getByRole("button", { name: "Editar código" }));
    expect(valueOf("Código")).toBe("EMT0020");
  });

  it("discards on Escape", () => {
    render(<CourseHeader course={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar descrição" }));
    fireEvent.keyDown(screen.getByLabelText("Descrição"), { key: "Escape" });

    expect(screen.queryByLabelText("Descrição")).toBeNull();
    expect(screen.getByText(course.summary!)).toBeTruthy();
  });

  it("saves one field with a PATCH and shows the new value", async () => {
    const fetchMock = mockFetch(200, { doc: {} });
    render(<CourseHeader course={course} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar nome da disciplina" }),
    );
    fireEvent.change(screen.getByLabelText("Nome da disciplina"), {
      target: { value: "  Mecatrônica I " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Mecatrônica I" }),
      ).toBeTruthy(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/courses/3?depth=0");
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({ title: "Mecatrônica I" });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("saves both workload hours together", async () => {
    const fetchMock = mockFetch(200, { doc: {} });
    render(<CourseHeader course={course} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar carga horária" }),
    );
    expect(valueOf("Horas teóricas")).toBe("30");
    fireEvent.change(screen.getByLabelText("Horas práticas"), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByText("30h teórica · 15h prática")).toBeTruthy(),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      workload: { theoretical: 30, practical: 15 },
    });
  });

  it("keeps the box open and explains when the value is invalid", () => {
    const fetchMock = mockFetch(200);
    render(<CourseHeader course={course} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar nome da disciplina" }),
    );
    fireEvent.change(screen.getByLabelText("Nome da disciplina"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByRole("alert").textContent).toMatch(/Informe o nome/);
    expect(screen.getByLabelText("Nome da disciplina")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the typed text when the server refuses the save", async () => {
    mockFetch(403, { errors: [{ message: "Forbidden" }] });
    render(<CourseHeader course={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar código" }));
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "EMT9999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/sessão/),
    );
    expect(valueOf("Código")).toBe("EMT9999");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("closes an open box when edit mode is switched off", () => {
    const { rerender } = render(<CourseHeader course={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar código" }));
    expect(screen.getByLabelText("Código")).toBeTruthy();

    editing = false;
    rerender(<CourseHeader course={course} />);

    expect(screen.queryByLabelText("Código")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
