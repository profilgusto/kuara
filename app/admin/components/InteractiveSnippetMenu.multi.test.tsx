/**
 * InteractiveSnippetMenu.multi.test.tsx — the submenu with more than one widget.
 *
 * Its own file because `vi.mock` is hoisted per module, and because with a
 * single catalogued widget "insert the one that was clicked" and "always
 * insert the first" behave identically — which is exactly the bug a submenu
 * built for a growing catalogue must not have.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

const { InteractiveSnippetMenu } = await import("./InteractiveSnippetMenu");

function openMenu() {
  const onInsert = vi.fn();
  render(<InteractiveSnippetMenu onInsert={onInsert} />);
  fireEvent.click(screen.getByRole("button", { name: /Bloco Interativo/ }));
  return onInsert;
}

const item = (title: string) =>
  screen.getByRole("menuitem", { name: new RegExp(title) });

describe("InteractiveSnippetMenu with several widgets", () => {
  it("lists them in catalogue order", () => {
    openMenu();
    const titles = screen
      .getAllByRole("menuitem")
      .map((el) => el.textContent ?? "");
    expect(titles[0]).toContain("Primeiro widget");
    expect(titles[1]).toContain("Segundo widget");
  });

  it("inserts the widget that was clicked, not the first one", () => {
    const onInsert = openMenu();
    fireEvent.click(item("Segundo widget"));

    expect(onInsert).toHaveBeenCalledTimes(1);
    const inserted = onInsert.mock.calls[0][0] as string;
    expect(inserted).toContain('widget="widget-b"');
    expect(inserted).not.toContain("widget-a");
  });

  it("carries each widget's own default height into its block", () => {
    const onInsert = openMenu();
    fireEvent.click(item("Primeiro widget"));
    expect(onInsert.mock.calls[0][0]).toContain('height="300"');
  });

  it("walks the list with the arrow keys, wrapping at both ends", () => {
    openMenu();
    const first = item("Primeiro widget");
    const second = item("Segundo widget");
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: "ArrowDown" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(document.activeElement).toBe(second);
  });

  it("falls back to a note when a widget has no drawing yet", () => {
    openMenu();
    // Neither stub is in `previews`, which is the state of any widget between
    // being registered and getting its print fallback.
    expect(screen.getAllByText("sem imagem")).toHaveLength(2);
  });
});
