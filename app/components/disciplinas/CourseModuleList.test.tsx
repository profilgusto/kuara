/**
 * CourseModuleList.test.tsx — the reorder controls on a course's module list.
 *
 * The drag itself is dnd-kit measuring real layout, which jsdom does not
 * have; what a drag does to the sequence is covered in
 * lib/module-order.test.ts. Here: when the controls show, and that cards
 * stop being links while they can be dragged.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CourseModule } from "@/lib/payload-content";
import { CourseModuleList } from "./CourseModuleList";

let editing = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/layout/EditModeContext", () => ({
  useEditMode: () => ({ editing }),
}));

const makeModule = (
  id: number,
  type: CourseModule["type"],
  order: number,
): CourseModule =>
  ({
    id: String(id),
    title: `Módulo ${id}`,
    slug: `modulo-${id}`,
    type,
    order,
    visible: true,
    number: null,
  }) as CourseModule;

const modules = [
  makeModule(1, "modulo-teorico", 1),
  makeModule(2, "modulo-pratico", 2),
  makeModule(3, "modulo-teorico", 3),
];

const list = () => (
  <CourseModuleList modules={modules} courseSlug="robotica" courseId={4} />
);

const titles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  editing = false;
});

describe("for a visitor", () => {
  it("links each card to its module, with no reorder control", () => {
    render(list());

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(
      screen.getByRole("link", { name: /Módulo 2/ }).getAttribute("href"),
    ).toBe("/disciplinas/robotica/modulo-2");
    expect(screen.queryByRole("button", { name: /Reordenar/ })).toBeNull();
  });

  it("lists by type in Grupos and in course order in Sequência", () => {
    render(list());
    expect(titles()).toEqual(["Módulo 1", "Módulo 3", "Módulo 2"]);

    fireEvent.click(screen.getByRole("button", { name: /Sequência/ }));
    expect(titles()).toEqual(["Módulo 1", "Módulo 2", "Módulo 3"]);
  });
});

describe("adding a module", () => {
  const assign = vi.fn();
  const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    editing = true;
    assign.mockClear();
    tab.close.mockClear();
    tab.opener = {};
    tab.location.href = "";
    open = vi.fn(() => tab);
    vi.stubGlobal("location", { assign });
    vi.stubGlobal("open", open);
  });

  function mockFetch(status: number, body: unknown = {}) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const addButton = () =>
    screen.queryByRole("button", { name: /Adicionar novo módulo/ });

  it("has no ghost card for a visitor", () => {
    editing = false;
    render(list());
    expect(addButton()).toBeNull();
  });

  it("shows the ghost card in both views, and on an empty course", () => {
    const { unmount } = render(list());
    expect(addButton()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sequência/ }));
    expect(addButton()).toBeTruthy();
    unmount();

    render(
      <CourseModuleList modules={[]} courseSlug="robotica" courseId={4} />,
    );
    expect(screen.getByText(/Nenhum módulo cadastrado/)).toBeTruthy();
    expect(addButton()).toBeTruthy();
  });

  it("hides it while the cards are being reordered", () => {
    render(list());
    fireEvent.click(screen.getByRole("button", { name: "Reordenar módulos" }));
    expect(addButton()).toBeNull();
  });

  it("creates a draft in this course and opens it in a new tab", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 77 } });
    render(list());
    fireEvent.click(addButton()!);

    // The tab is opened during the click itself, before the server answers.
    expect(open).toHaveBeenCalledWith("", "_blank");
    await waitFor(() =>
      expect(tab.location.href).toBe("/payload/collections/modules/77"),
    );
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
    // This page stays where it is, ready for another one.
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(addButton()).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/modules?draft=true&depth=0");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      title: "Novo módulo",
      course: 4,
      _status: "draft",
    });
    expect(body.slug).toMatch(/^novo-modulo-/);
    // The server decides the order (last); the page does not send one.
    expect(body).not.toHaveProperty("order");
  });

  it("stays on the page and says so when the server refuses", async () => {
    mockFetch(403, { errors: [{ message: "Forbidden" }] });
    render(list());
    fireEvent.click(addButton()!);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/sessão/),
    );
    expect(assign).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalled();
    expect(addButton()).toBeTruthy();
  });

  it("goes there in this tab when the browser blocks the new one", async () => {
    open.mockReturnValue(null);
    mockFetch(201, { doc: { id: 77 } });
    render(list());
    fireEvent.click(addButton()!);

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/payload/collections/modules/77"),
    );
  });
});

describe("in edit mode", () => {
  beforeEach(() => {
    editing = true;
  });

  it("shows the pencil, and keeps the cards as links until it is used", () => {
    render(list());

    expect(
      screen.getByRole("button", { name: "Reordenar módulos" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("turns the cards into drag handles, with nothing to save yet", () => {
    render(list());
    fireEvent.click(screen.getByRole("button", { name: "Reordenar módulos" }));

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByLabelText("Mover Módulo 1")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Salvar ordem",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /Reordenar/ })).toBeNull();
  });

  it("goes back to links on discard", () => {
    render(list());
    fireEvent.click(screen.getByRole("button", { name: "Reordenar módulos" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Reordenar módulos" }),
    ).toBeTruthy();
  });

  it("stops reordering when edit mode is switched off", () => {
    const { rerender } = render(list());
    fireEvent.click(screen.getByRole("button", { name: "Reordenar módulos" }));

    editing = false;
    rerender(list());

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Salvar ordem" })).toBeNull();
  });
});
