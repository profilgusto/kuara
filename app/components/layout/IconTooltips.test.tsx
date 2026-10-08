/**
 * IconTooltips.test.tsx — the instant tooltip under icon-only buttons.
 */
import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { IconTooltips } from "./IconTooltips";

const tooltip = () => document.querySelector("[data-icon-tooltip]");

function page() {
  return render(
    <>
      <button aria-label="Alternar tema" title="Alternar tema">
        <svg data-testid="sun" />
      </button>
      <button aria-label="Ordenar por nome">Nome</button>
      <button aria-label="Editar tabela">
        <svg />
      </button>
      <p>texto</p>
      <IconTooltips />
    </>,
  );
}

describe("IconTooltips", () => {
  it("shows nothing until a button is hovered", () => {
    page();
    expect(tooltip()).toBeNull();
  });

  it("names an icon button the moment the pointer is over it", () => {
    page();
    fireEvent.pointerOver(
      screen.getByRole("button", { name: "Editar tabela" }),
    );
    expect(tooltip()?.textContent).toBe("Editar tabela");
  });

  it("works when the pointer lands on the icon inside the button", () => {
    page();
    fireEvent.pointerOver(screen.getByTestId("sun"));
    expect(tooltip()?.textContent).toBe("Alternar tema");
  });

  it("is hidden from assistive technology: it repeats the button's name", () => {
    page();
    fireEvent.pointerOver(
      screen.getByRole("button", { name: "Editar tabela" }),
    );
    expect(tooltip()?.getAttribute("aria-hidden")).toBe("true");
  });

  it("goes away when the pointer leaves", () => {
    page();
    const button = screen.getByRole("button", { name: "Editar tabela" });
    fireEvent.pointerOver(button);
    fireEvent.pointerOut(button, { relatedTarget: screen.getByText("texto") });
    expect(tooltip()).toBeNull();
  });

  it("stays while the pointer moves within the same button", () => {
    page();
    const button = screen.getByRole("button", { name: "Alternar tema" });
    fireEvent.pointerOver(button);
    fireEvent.pointerOut(button, { relatedTarget: screen.getByTestId("sun") });
    expect(tooltip()?.textContent).toBe("Alternar tema");
  });

  it("moves straight from one button to the next", () => {
    page();
    fireEvent.pointerOver(
      screen.getByRole("button", { name: "Alternar tema" }),
    );
    fireEvent.pointerOver(
      screen.getByRole("button", { name: "Editar tabela" }),
    );
    expect(document.querySelectorAll("[data-icon-tooltip]")).toHaveLength(1);
    expect(tooltip()?.textContent).toBe("Editar tabela");
  });

  it("says nothing about a button that already shows its words", () => {
    page();
    fireEvent.pointerOver(
      screen.getByRole("button", { name: "Ordenar por nome" }),
    );
    expect(tooltip()).toBeNull();
  });

  it("sets the native title aside while showing, and puts it back", () => {
    page();
    const button = screen.getByRole("button", { name: "Alternar tema" });
    fireEvent.pointerOver(button);
    expect(button.hasAttribute("title")).toBe(false);

    fireEvent.pointerOut(button, { relatedTarget: document.body });
    expect(button.getAttribute("title")).toBe("Alternar tema");
  });

  it("gets out of the way on click and on Escape", () => {
    page();
    const button = screen.getByRole("button", { name: "Editar tabela" });
    fireEvent.pointerOver(button);
    fireEvent.pointerDown(button);
    expect(tooltip()).toBeNull();

    fireEvent.pointerOver(
      screen.getByRole("button", { name: "Alternar tema" }),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tooltip()).toBeNull();
  });

  it("ignores touch, which has no hover", () => {
    page();
    fireEvent.pointerOver(
      screen.getByRole("button", { name: "Editar tabela" }),
      {
        pointerType: "touch",
      },
    );
    expect(tooltip()).toBeNull();
  });

  it("shows on keyboard focus and hides on blur", () => {
    page();
    const button = screen.getByRole("button", { name: "Editar tabela" });
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => button.focus());
    expect(tooltip()?.textContent).toBe("Editar tabela");
    act(() => button.blur());
    expect(tooltip()).toBeNull();
  });

  it("does not come back from the focus a click gives", () => {
    page();
    const button = screen.getByRole("button", { name: "Editar tabela" });
    fireEvent.pointerOver(button);
    fireEvent.pointerDown(button);
    act(() => button.focus());
    expect(tooltip()).toBeNull();
  });
});
