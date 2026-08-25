/**
 * InteractiveSnippetMenu.test.tsx — the toolbar's widget submenu.
 *
 * The point of the submenu is that the toolbar stays one button wide however
 * many widgets exist, so the tests care about two things: nothing from the
 * catalogue is on screen until asked for, and choosing an entry hands the
 * field the same snippet the library view hands out.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { InteractiveSnippetMenu } from "./InteractiveSnippetMenu";
import { interactiveTemplate } from "./interactive-snippet";
import { catalog, widgetIds } from "@/components/interactive/catalog";

const FIRST = widgetIds()[0];

function setup() {
  const onInsert = vi.fn();
  render(<InteractiveSnippetMenu onInsert={onInsert} />);
  const trigger = screen.getByRole("button", { name: /Bloco Interativo/ });
  return { onInsert, trigger };
}

describe("InteractiveSnippetMenu — closed", () => {
  it("shows a single collapsed trigger, not one button per widget", () => {
    setup();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("marks the trigger as a collapsed menu for assistive tech", () => {
    const { trigger } = setup();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("names no widget before it is opened", () => {
    setup();
    expect(screen.queryByText(catalog[FIRST].title)).toBeNull();
  });
});

describe("InteractiveSnippetMenu — open", () => {
  it("lists every catalogued widget with its id and name", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);

    const menu = screen.getByRole("menu");
    for (const id of widgetIds()) {
      const item = within(menu).getByRole("menuitem", {
        name: new RegExp(catalog[id].title),
      });
      expect(within(item).getByText(id)).toBeDefined();
    }
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("draws each widget's preview in its row", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const item = screen.getByRole("menuitem", {
      name: new RegExp(catalog[FIRST].title),
    });
    expect(item.querySelector("svg")).not.toBeNull();
  });

  it("inserts the widget's template and closes", () => {
    const { trigger, onInsert } = setup();
    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole("menuitem", { name: new RegExp(catalog[FIRST].title) }),
    );

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0][0]).toBe(interactiveTemplate(catalog[FIRST]));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves focus alone on insert, so the caret stays in the editor", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole("menuitem", { name: new RegExp(catalog[FIRST].title) }),
    );
    expect(document.activeElement).not.toBe(trigger);
  });

  it("moves focus into the list so it is usable from the keyboard", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: new RegExp(catalog[FIRST].title) }),
    );
  });

  it("closes on Escape and gives focus back to the trigger", () => {
    const { trigger, onInsert } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("closes when the author clicks elsewhere", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("stays open while clicking inside itself", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole("menu"));
    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("toggles shut when the trigger is clicked again", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
