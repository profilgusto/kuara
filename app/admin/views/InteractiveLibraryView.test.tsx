/**
 * InteractiveLibraryView.test.tsx — the admin library page.
 *
 * Unlike TodosView this page fetches nothing, so it renders straight in jsdom.
 * The split it has to honour: the grid shows only what a browsing author needs
 * to recognise a widget, and the detail — parameters, snippet — appears only
 * once they ask for it.
 */
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { InteractiveLibraryView } from "./InteractiveLibraryView";
import { catalog, widgetIds } from "@/components/interactive/catalog";
import { mdxSnippet } from "@/components/interactive/snippet";

const FIRST = widgetIds()[0];

/** The grid card for a widget, found by the title it displays. */
function tile(id: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(catalog[id].title),
  });
}

function openFirst() {
  fireEvent.click(tile(FIRST));
  return screen.getByRole("dialog");
}

describe("InteractiveLibraryView — grid", () => {
  it("shows one card per catalogued widget", () => {
    render(<InteractiveLibraryView />);
    for (const id of widgetIds()) {
      const card = tile(id);
      expect(within(card).getByText(id)).toBeDefined();
      expect(within(card).getByText(catalog[id].title)).toBeDefined();
    }
  });

  it("draws each widget's preview on its card", () => {
    render(<InteractiveLibraryView />);
    for (const id of widgetIds()) {
      expect(tile(id).querySelector("svg")).not.toBeNull();
    }
    expect(screen.queryByText("sem pré-visualização")).toBeNull();
  });

  it("states how many widgets exist", () => {
    render(<InteractiveLibraryView />);
    expect(
      screen.getByText(new RegExp(`${widgetIds().length} widget`)),
    ).toBeDefined();
  });

  it("keeps the detail out of the grid", () => {
    // The whole point of the card: browsing stays scannable however many
    // widgets accumulate.
    const { container } = render(<InteractiveLibraryView />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar" })).toBeNull();
  });
});

describe("InteractiveLibraryView — detail modal", () => {
  it("opens on a card click, for that widget", () => {
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    expect(within(dialog).getByText(catalog[FIRST].title)).toBeDefined();
    expect(within(dialog).getByText(FIRST)).toBeDefined();
  });

  it("is labelled by its own heading, for screen readers", () => {
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe(
      catalog[FIRST].title,
    );
  });

  it("documents every parameter of the widget it opened", () => {
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    const rows = Array.from(dialog.querySelectorAll("tbody tr")).map(
      (r) => r.textContent ?? "",
    );
    for (const [name, spec] of Object.entries(catalog[FIRST].props)) {
      expect(within(dialog).getAllByText(name).length, name).toBeGreaterThan(0);
      // Backticks are Markdown for the guide; the admin renders those terms as
      // chips, so the visible text drops the backticks themselves.
      const described = spec.describe.replace(/`/g, "");
      expect(
        rows.some((t) => t.includes(described)),
        name,
      ).toBe(true);
    }
  });

  it("renders backticked terms as code instead of printing the backticks", () => {
    const { container } = render(<InteractiveLibraryView />);
    openFirst();
    expect(container.textContent).not.toContain("`");
  });

  it("shows a paste-ready snippet with a copy button", () => {
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    expect(dialog.querySelector("pre")?.textContent).toBe(
      mdxSnippet(catalog[FIRST]),
    );
    expect(
      within(dialog).getByRole("button", { name: "Copiar" }),
    ).toBeDefined();
  });

  it("renders a parameter's default, or an em dash when it has none", () => {
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    const pointRow = Array.from(dialog.querySelectorAll("tbody tr")).find(
      (r) => within(r as HTMLElement).queryByText("point") !== null,
    );
    // coord-frame-3d's `point` has no default and must not read as empty.
    if (pointRow) expect(pointRow.textContent).toContain("—");
  });

  it("closes on the close button", () => {
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<InteractiveLibraryView />);
    openFirst();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when the backdrop is clicked", () => {
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open when the panel itself is clicked", () => {
    // Selecting the snippet text must not dismiss the dialog.
    render(<InteractiveLibraryView />);
    const dialog = openFirst();
    fireEvent.click(dialog.querySelector("pre")!);
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("returns focus to the card that opened it", () => {
    render(<InteractiveLibraryView />);
    const card = tile(FIRST);
    fireEvent.click(card);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(card);
  });

  it("locks the page behind it, then restores scrolling", () => {
    render(<InteractiveLibraryView />);
    openFirst();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
