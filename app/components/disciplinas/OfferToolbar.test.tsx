/**
 * OfferToolbar.test.tsx — the bar that picks which offer is on screen.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
    render(<OfferToolbar offers={offers} activePeriod="2026.2" />);

    const select = screen.getByLabelText("Oferta") as HTMLSelectElement;
    expect(select.value).toBe("2026.2");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["2026.2", "2026.1", "2025.2 (arquivada)"]);
  });

  it("puts the chosen offer in the address, without leaving the page", () => {
    render(<OfferToolbar offers={offers} activePeriod="2026.2" />);
    fireEvent.change(screen.getByLabelText("Oferta"), {
      target: { value: "2025.2" },
    });

    expect(router.replace).toHaveBeenCalledWith(
      "/disciplinas/automacao-industrial/ofertas?oferta=2025.2",
      { scroll: false },
    );
  });

  it("says so when the course has no offers, instead of an empty dropdown", () => {
    render(<OfferToolbar offers={[]} activePeriod={null} />);

    expect(screen.getByRole("toolbar")).toBeTruthy();
    expect(screen.getByText("Nenhuma oferta cadastrada")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
