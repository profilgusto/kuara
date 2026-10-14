import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CourseOffer } from "./CourseOffer";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const respond = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe("CourseOffer", () => {
  it("titles the block with the active period and holds both sections", async () => {
    fetchMock
      .mockReturnValueOnce(respond({ activeTerm: { id: 7, period: "2026.2" } }))
      .mockReturnValueOnce(respond({ docs: [{ id: 2, period: "2026.2" }] }));
    render(<CourseOffer courseId={3} />);
    expect(
      await screen.findByRole("heading", { name: "Oferta 2026.2" }),
    ).toBeTruthy();
    expect(fetchMock.mock.calls[1][0]).toContain("[period][equals]=2026.2");
    expect(screen.getByRole("button", { name: /Avaliações/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Grupos/ })).toBeTruthy();
  });

  it("renders nothing when no offer is active", async () => {
    fetchMock.mockReturnValueOnce(respond({ activeTerm: null }));
    const { container } = render(<CourseOffer courseId={3} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the course has no offer for the active period", async () => {
    fetchMock
      .mockReturnValueOnce(respond({ activeTerm: { id: 7, period: "2026.2" } }))
      .mockReturnValueOnce(respond({ docs: [] }));
    const { container } = render(<CourseOffer courseId={3} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(container.innerHTML).toBe("");
  });
});
