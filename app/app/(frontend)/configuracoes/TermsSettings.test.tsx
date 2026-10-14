import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TermsSettings } from "./TermsSettings";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn();
beforeEach(() => {
  router.refresh.mockClear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  vi.stubGlobal("fetch", fetchMock);
});

const terms = [
  { id: 2, period: "2026.2" },
  { id: 1, period: "2026.1" },
];

describe("TermsSettings", () => {
  it("activates an offer sending its id as a number", async () => {
    render(<TermsSettings terms={terms} activeTermId={null} />);
    fireEvent.change(screen.getByLabelText("Oferta ativa"), {
      target: { value: "2" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/globals/site-settings");
    expect(JSON.parse(init.body)).toEqual({ activeTerm: 2 });
  });

  it("sends null for 'Nenhuma'", async () => {
    render(<TermsSettings terms={terms} activeTermId={2} />);
    fireEvent.change(screen.getByLabelText("Oferta ativa"), {
      target: { value: "" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      activeTerm: null,
    });
  });

  it("creates an offer by period", async () => {
    render(<TermsSettings terms={terms} activeTermId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/terms");
    expect(JSON.parse(init.body)).toEqual({ period: "2027.1" });
  });
});
