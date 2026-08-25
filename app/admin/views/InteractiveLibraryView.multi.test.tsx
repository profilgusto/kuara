/**
 * InteractiveLibraryView.multi.test.tsx — the page with more than one widget.
 *
 * A separate file because `vi.mock` is hoisted per module: this one swaps the
 * catalogue for a two-entry stub, while the sibling suite exercises the real
 * one. With a single catalogued widget "open the card that was clicked" and
 * "always open the first card" are indistinguishable, and the whole point of
 * the grid is the day that stops being true.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { bool, str } from "@/components/interactive/props";

const stub = {
  "widget-a": {
    id: "widget-a",
    title: "Primeiro widget",
    description: "Descrição do primeiro.",
    defaultHeight: 300,
    props: { alpha: bool(true, "Parâmetro do primeiro.") },
  },
  "widget-b": {
    id: "widget-b",
    title: "Segundo widget",
    description: "Descrição do segundo.",
    defaultHeight: 400,
    props: { beta: str("z", "Parâmetro do segundo.") },
  },
};

vi.mock("@/components/interactive/catalog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/interactive/catalog")>();
  return {
    ...actual,
    catalog: stub,
    widgetIds: () => Object.keys(stub).sort(),
  };
});

const { InteractiveLibraryView } = await import("./InteractiveLibraryView");

const tile = (title: string) =>
  screen.getByRole("button", { name: new RegExp(title) });

describe("InteractiveLibraryView with several widgets", () => {
  it("renders a card for each one", () => {
    render(<InteractiveLibraryView />);
    expect(tile("Primeiro widget")).toBeDefined();
    expect(tile("Segundo widget")).toBeDefined();
    expect(screen.getByText(/2 widgets disponíveis/)).toBeDefined();
  });

  it("opens the widget whose card was clicked, not the first one", () => {
    render(<InteractiveLibraryView />);
    fireEvent.click(tile("Segundo widget"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Segundo widget")).toBeDefined();
    expect(within(dialog).getByText("Descrição do segundo.")).toBeDefined();
    expect(within(dialog).getByText("beta")).toBeDefined();
    expect(within(dialog).queryByText("Primeiro widget")).toBeNull();
    expect(within(dialog).queryByText("alpha")).toBeNull();
  });

  it("gives each widget its own snippet", () => {
    render(<InteractiveLibraryView />);

    fireEvent.click(tile("Primeiro widget"));
    expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(
      '<Interactive widget="widget-a" height="300">\n' +
        "Caption shown below the block, and in place of it when printing.\n" +
        "</Interactive>",
    );
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(tile("Segundo widget"));
    expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(
      '<Interactive widget="widget-b" height="400">\n' +
        "Caption shown below the block, and in place of it when printing.\n" +
        "</Interactive>",
    );
  });

  it("shows one dialog at a time, swapping content between cards", () => {
    render(<InteractiveLibraryView />);
    fireEvent.click(tile("Primeiro widget"));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(tile("Segundo widget"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("returns focus to whichever card was clicked", () => {
    render(<InteractiveLibraryView />);
    const second = tile("Segundo widget");
    fireEvent.click(second);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(second);
  });

  it("says so plainly when a widget has no drawing", () => {
    // These stubs are not in the preview registry, which is the same state a
    // freshly added widget is in before its print fallback exists.
    render(<InteractiveLibraryView />);
    expect(screen.getAllByText("sem pré-visualização")).toHaveLength(2);
  });
});
