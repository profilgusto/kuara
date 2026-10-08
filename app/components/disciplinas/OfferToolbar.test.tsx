/**
 * OfferToolbar.test.tsx — the bar that picks which offer is on screen.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfferToolbar } from "./OfferToolbar";

const router = { replace: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/disciplinas/automacao-industrial/ofertas",
}));

const offers = [
  { id: 2, period: "2026.2", status: "active" },
  { id: 3, period: "2026.1", status: "active" },
  { id: 1, period: "2025.2", status: "archived" },
];

beforeEach(() => {
  router.replace.mockClear();
  router.refresh.mockClear();
  vi.unstubAllGlobals();
});

describe("OfferToolbar", () => {
  it("lists the offers in the order given, with the active one selected", () => {
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);

    const select = screen.getByLabelText("Oferta") as HTMLSelectElement;
    expect(select.value).toBe("2026.2");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["2026.2", "2026.1", "2025.2 (arquivada)"]);
  });

  it("puts the chosen offer in the address, without leaving the page", () => {
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    fireEvent.change(screen.getByLabelText("Oferta"), {
      target: { value: "2025.2" },
    });

    expect(router.replace).toHaveBeenCalledWith(
      "/disciplinas/automacao-industrial/ofertas?oferta=2025.2",
      { scroll: false },
    );
  });

  it("says so when the course has no offers, instead of an empty dropdown", () => {
    render(<OfferToolbar courseId={3} offers={[]} activePeriod={null} />);

    expect(screen.getByRole("toolbar")).toBeTruthy();
    expect(screen.getByText("Nenhuma oferta cadastrada")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("creating an offer", () => {
  function mockFetch(status: number, body: unknown = {}) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const openDialog = () =>
    fireEvent.click(screen.getByRole("button", { name: "Criar oferta" }));
  const valueOf = (label: string) =>
    (screen.getByLabelText(label) as HTMLInputElement).value;
  const type = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it("offers the button even for a course with no offers", () => {
    render(<OfferToolbar courseId={3} offers={[]} activePeriod={null} />);
    expect(screen.getByRole("button", { name: "Criar oferta" })).toBeTruthy();
  });

  it("opens on the semester after the most recent offer", () => {
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    openDialog();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(valueOf("Ano")).toBe("2027");
    expect(valueOf("Semestre")).toBe("1");
  });

  it("only lets a year and a 1 or 2 be typed", () => {
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    openDialog();

    type("Ano", "20x28.9");
    expect(valueOf("Ano")).toBe("2028");
    type("Semestre", "3");
    expect(valueOf("Semestre")).toBe("");
    type("Semestre", "2");
    expect(valueOf("Semestre")).toBe("2");
  });

  it("creates the offer and switches to it", async () => {
    const fetchMock = mockFetch(201, { doc: { id: 9 } });
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    openDialog();
    type("Ano", "2028");
    type("Semestre", "2");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/disciplinas/automacao-industrial/ofertas?oferta=2028.2",
        { scroll: false },
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/offers?depth=0");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({
      period: "2028.2",
      course: 3,
      status: "active",
    });
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("refuses an offer that already exists, without calling the server", () => {
    const fetchMock = mockFetch(201);
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    openDialog();
    type("Ano", "2026");
    type("Semestre", "1");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "A oferta 2026.1 já existe.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("refuses an incomplete period", () => {
    const fetchMock = mockFetch(201);
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    openDialog();
    type("Ano", "202");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(screen.getByRole("alert").textContent).toMatch(/quatro dígitos/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and explains when the server refuses", async () => {
    mockFetch(403, { errors: [{ message: "Forbidden" }] });
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/sessão/);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("reports a duplicate caught only by the server", async () => {
    mockFetch(400, {
      errors: [{ data: { errors: [{ path: "period", message: "dup" }] } }],
    });
    render(<OfferToolbar courseId={3} offers={offers} activePeriod="2026.2" />);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "A oferta 2027.1 já existe.",
    );
  });
});
