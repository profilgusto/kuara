/**
 * admin-auth.test.tsx — the gate on Payload's custom admin views.
 *
 * Payload gives custom root views no authentication of its own, so these
 * wrappers are the only thing standing between `/payload/interativos` (and
 * `/payload/todos`) and an anonymous visitor. The check has to fail closed:
 * every shape that is not "Payload resolved a user" counts as no user.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { hasAdminUser, type ViewProps } from "./admin-auth";
import InteractiveLibraryPage from "./InteractiveLibraryPage";
import TodosPage from "./TodosPage";
import { catalog, widgetIds } from "@/components/interactive/catalog";

// TodosView pulls in @payloadcms/ui, whose CSS imports Node cannot load under
// Vitest. The gate does not care what it wraps, so a marker stands in for it.
vi.mock("./TodosView", () => ({
  default: () => <div>lista de pendências</div>,
}));

const withUser = {
  initPageResult: { req: { user: { id: 1, email: "a@b.c" } } },
} as unknown as ViewProps;

describe("hasAdminUser", () => {
  it("accepts a request that carries a user", () => {
    expect(hasAdminUser(withUser)).toBe(true);
  });

  it.each([
    ["no props at all", undefined],
    ["empty props", {}],
    ["no initPageResult", { params: {} }],
    ["initPageResult without req", { initPageResult: {} }],
    ["req without user", { initPageResult: { req: {} } }],
    ["an explicitly null user", { initPageResult: { req: { user: null } } }],
  ])("rejects %s", (_label, props) => {
    expect(hasAdminUser(props as ViewProps)).toBe(false);
  });
});

describe("InteractiveLibraryPage", () => {
  it("renders the library for a logged-in user", () => {
    render(<InteractiveLibraryPage {...withUser} />);
    expect(screen.getByText(catalog[widgetIds()[0]].title)).toBeDefined();
    expect(screen.queryByText("Acesso restrito")).toBeNull();
  });

  it("shows nothing but the notice with no session", () => {
    render(<InteractiveLibraryPage />);
    expect(screen.getByText("Acesso restrito")).toBeDefined();
    expect(screen.getByRole("link", { name: /login/i })).toBeDefined();
    // The catalogue must not reach an anonymous visitor, not even hidden.
    expect(screen.queryByText(catalog[widgetIds()[0]].title)).toBeNull();
  });
});

describe("TodosPage", () => {
  it("shows the notice with no session", () => {
    render(<TodosPage />);
    expect(screen.getByText("Acesso restrito")).toBeDefined();
  });

  it("keeps the list itself off the page", () => {
    render(<TodosPage />);
    expect(screen.queryByText("lista de pendências")).toBeNull();
  });

  it("renders the list for a logged-in user", () => {
    render(<TodosPage {...withUser} />);
    expect(screen.getByText("lista de pendências")).toBeDefined();
  });
});
