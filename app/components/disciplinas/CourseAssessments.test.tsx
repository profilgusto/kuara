/**
 * CourseAssessments.test.tsx — the collapsible assessments block of the
 * course page: hidden when signed out, loads the latest offer on expansion.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CourseAssessments } from "./CourseAssessments";

let signedIn = true;
vi.mock("@/components/layout/SessionContext", () => ({
  useSession: () => ({
    session: signedIn
      ? { id: 1, name: "A", email: "a@x", role: "admin" }
      : null,
  }),
}));

const json = (docs: unknown[]) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ docs }) });

const fetchMock = vi.fn();
beforeEach(() => {
  signedIn = true;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("CourseAssessments", () => {
  it("renders nothing for a signed-out visitor", () => {
    signedIn = false;
    const { container } = render(<CourseAssessments courseId={3} />);
    expect(container.innerHTML).toBe("");
  });

  it("stays collapsed and fetches nothing until opened", () => {
    render(<CourseAssessments courseId={3} />);
    expect(
      screen
        .getByRole("button", { name: /Avaliações/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the assessments of the most recent offer", async () => {
    fetchMock
      .mockReturnValueOnce(
        json([
          { id: 1, period: "2025.2" },
          { id: 2, period: "2026.1" },
        ]),
      )
      .mockReturnValueOnce(
        json([
          {
            id: 9,
            acronym: "P1",
            description: "Prova 1",
            weight: 2.5,
            dueDate: "2026-04-10T12:00:00.000Z",
            comment: "Sem consulta",
          },
          { id: 10, acronym: "T1", description: "Trabalho", weight: 1 },
        ]),
      );
    render(<CourseAssessments courseId={3} />);
    fireEvent.click(screen.getByRole("button", { name: /Avaliações/ }));

    expect(await screen.findByText("Prova 1")).toBeTruthy();
    expect(fetchMock.mock.calls[1][0]).toContain("[offer][equals]=2&");
    expect(screen.getByText("P1")).toBeTruthy();
    expect(screen.getByText("2.5")).toBeTruthy();
    expect(screen.getByText("10/04/2026")).toBeTruthy();
    expect(screen.getByText("Sem consulta")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    // 2.5 regular + 1 regular; add an extra below in its own test.
    expect(document.querySelector('[data-total="regular"]')?.textContent).toBe(
      "3.5",
    );
    expect(document.querySelector('[data-total="total"]')?.textContent).toBe(
      "3.5",
    );
  });

  it("adds extras to the grand total but not to the regular sum", async () => {
    fetchMock.mockReturnValueOnce(json([{ id: 1, period: "2026.1" }]));
    fetchMock.mockReturnValueOnce(
      json([
        { id: 1, acronym: "P1", description: "Prova", weight: 10 },
        {
          id: 2,
          acronym: "B1",
          description: "Bônus",
          weight: 0.5,
          category: "extra",
        },
      ]),
    );
    render(<CourseAssessments courseId={3} />);
    fireEvent.click(screen.getByRole("button", { name: /Avaliações/ }));
    await screen.findByText("Bônus");
    expect(document.querySelector('[data-total="regular"]')?.textContent).toBe(
      "10.0",
    );
    expect(document.querySelector('[data-total="extra"]')?.textContent).toBe(
      "0.5",
    );
    expect(document.querySelector('[data-total="total"]')?.textContent).toBe(
      "10.5",
    );
    expect(
      document.querySelector("tfoot")?.textContent?.replace(/\s+/g, " "),
    ).toBe(
      "Pontuação total do período: 10.0 pts + 0.5 pt extra = 10.5 pontos totais distribuídos",
    );
  });

  it("says so when the course has no offer", async () => {
    fetchMock.mockReturnValueOnce(json([]));
    render(<CourseAssessments courseId={3} />);
    fireEvent.click(screen.getByRole("button", { name: /Avaliações/ }));
    expect(await screen.findByText(/ainda não tem oferta/)).toBeTruthy();
  });

  it("offers a retry when loading fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    render(<CourseAssessments courseId={3} />);
    fireEvent.click(screen.getByRole("button", { name: /Avaliações/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });
});
