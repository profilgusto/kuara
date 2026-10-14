import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CourseGroups } from "./CourseGroups";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const respond = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe("CourseGroups", () => {
  it("stays collapsed and fetches nothing until opened", () => {
    render(<CourseGroups offerId={2} />);
    expect(
      screen
        .getByRole("button", { name: /Grupos/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists groups and members for a visitor with no session", async () => {
    fetchMock.mockReturnValueOnce(
      respond({
        groups: [{ id: 1, name: "Grupo 1", members: ["Ana", "Bruno"] }],
        ungrouped: ["Caio R. Reis"],
      }),
    );
    render(<CourseGroups offerId={2} />);
    fireEvent.click(screen.getByRole("button", { name: /Grupos/ }));
    await waitFor(() => screen.getByText("Grupo 1"));
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.getByText("Sem grupo")).toBeTruthy();
    expect(screen.getByText("Caio R. Reis")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/student-groups/public?offer=2",
    );
  });

  it("says so when the offer has no groups", async () => {
    fetchMock.mockReturnValueOnce(respond({ groups: [], ungrouped: [] }));
    render(<CourseGroups offerId={2} />);
    fireEvent.click(screen.getByRole("button", { name: /Grupos/ }));
    await waitFor(() =>
      screen.getByText("Nenhum grupo cadastrado nesta oferta."),
    );
  });
});
