/**
 * InteractiveBox.test.tsx — the framing contract shared by every widget.
 *
 * The registry is mocked out so this stays a Phase 1 test: the real one pulls
 * three.js through `next/dynamic`, which has no business running in jsdom.
 * What is under test here is the box, not any particular widget.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ViewModeProvider } from "@/components/mdx/useViewMode";
import { bool, num, str } from "./props";

const fakeMeta = {
  id: "fake-widget",
  title: "Widget de teste",
  description: "Usado apenas pelos testes da moldura.",
  defaultHeight: 300,
  props: {
    labels: bool(true, "descrição"),
    size: num(2, "descrição", { min: 1, max: 5 }),
    name: str("A", "descrição"),
  },
};

/** Renders the props it received, so we can assert on what the box coerced. */
function FakeWidget(props: Record<string, unknown>) {
  return (
    // The key list is carried separately: JSON.stringify drops a key whose
    // value is `undefined`, which would hide a prop the box should not have
    // passed at all.
    <div data-testid="widget" data-keys={Object.keys(props).join(",")}>
      {JSON.stringify(props)}
    </div>
  );
}

/** Stands in for a widget's vector print drawing. */
function FakePrint(props: Record<string, unknown>) {
  return (
    <svg data-testid="print-fallback" data-props={JSON.stringify(props)} />
  );
}

/** A widget that offers the header's view switcher; the fake one does not. */
const switchyMeta = {
  ...fakeMeta,
  id: "switchy",
  title: "Título do catálogo",
  variants: [
    { id: "1d", label: "1D", title: "Uma dimensão", hint: "Ver em 1D" },
    { id: "2d", label: "2D", title: "Duas dimensões" },
    { id: "3d", label: "3D", title: "Três dimensões" },
  ],
  defaultVariant: "3d",
};

vi.mock("./registry", () => ({
  getWidget: (id: string | undefined) => {
    if (id === "fake-widget")
      return {
        meta: fakeMeta,
        Component: FakeWidget,
        PrintFallback: FakePrint,
      };
    // A widget that never learned to draw itself on paper.
    if (id === "switchy")
      return {
        meta: switchyMeta,
        Component: FakeWidget,
        PrintFallback: FakePrint,
      };
    if (id === "unanchored")
      // Same buttons, but no `defaultVariant` — the first one should win.
      return {
        meta: { ...switchyMeta, id: "unanchored", defaultVariant: undefined },
        Component: FakeWidget,
      };
    if (id === "print-less")
      return { meta: { ...fakeMeta, id: "print-less" }, Component: FakeWidget };
    return null;
  },
  implementedIds: () => ["fake-widget", "print-less", "switchy"],
}));

// Imported after the mock so the box picks up the stubbed registry.
const { default: Interactive } = await import("./InteractiveBox");

function widgetKeys() {
  return (screen.getByTestId("widget").getAttribute("data-keys") || "").split(
    ",",
  );
}

function widgetProps() {
  return JSON.parse(screen.getByTestId("widget").textContent || "{}");
}

function stageEl(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-interactive-stage]");
}

describe("InteractiveBox", () => {
  it("renders the widget with the catalogue defaults", () => {
    render(<Interactive widget="fake-widget" />);
    expect(widgetProps()).toEqual({ labels: true, size: 2, name: "A" });
  });

  it("shows the catalogue title in the header", () => {
    render(<Interactive widget="fake-widget" />);
    expect(screen.getByText("Widget de teste")).toBeDefined();
  });

  it("lets the author override the title", () => {
    render(<Interactive widget="fake-widget" title="Meu título" />);
    expect(screen.getByText("Meu título")).toBeDefined();
    expect(screen.queryByText("Widget de teste")).toBeNull();
  });

  it("coerces the string attributes a directive produces", () => {
    render(
      // Exactly the shape `:::interactive{labels=false size=4}` yields.
      <Interactive widget="fake-widget" labels="false" size="4" />,
    );
    expect(widgetProps()).toEqual({ labels: false, size: 4, name: "A" });
  });

  it("does not mistake its own box-level props for widget parameters", () => {
    render(
      <Interactive
        widget="fake-widget"
        title="t"
        height="250"
        poster="/media/x.png"
      />,
    );
    // Box keys must never reach the widget, nor be reported to the author as
    // unknown parameters.
    expect(Object.keys(widgetProps()).sort()).toEqual([
      "labels",
      "name",
      "size",
    ]);
    expect(screen.queryByText("Parâmetros ignorados")).toBeNull();
  });

  it("applies the authored height to the stage", () => {
    const { container } = render(
      <Interactive widget="fake-widget" height="250" />,
    );
    expect(stageEl(container)?.style.height).toBe("250px");
  });

  it("falls back to the widget's default height", () => {
    const { container } = render(<Interactive widget="fake-widget" />);
    expect(stageEl(container)?.style.height).toBe("300px");
  });

  // The presentation-mode cap emits a CSS `min()`, which jsdom's style engine
  // drops before it reaches the DOM — that rule is covered in stage.test.ts.
  it("uses the plain authored height while reading", () => {
    const { container } = render(
      <ViewModeProvider mode="texto">
        <Interactive widget="fake-widget" />
      </ViewModeProvider>,
    );
    expect(stageEl(container)?.style.height).toBe("300px");
  });

  it("surfaces a rejected parameter instead of failing silently", () => {
    render(<Interactive widget="fake-widget" size="enorme" />);
    expect(screen.getByText("Parâmetros ignorados")).toBeDefined();
    expect(screen.getByText(/size:.*numérico/)).toBeDefined();
    // …and still renders the widget, on the default.
    expect(widgetProps().size).toBe(2);
  });

  it("surfaces a misspelled parameter", () => {
    render(<Interactive widget="fake-widget" label="true" />);
    expect(screen.getByText(/parâmetro desconhecido: label/)).toBeDefined();
  });

  it("surfaces an out-of-range height and clamps it", () => {
    const { container } = render(
      <Interactive widget="fake-widget" height="5000" />,
    );
    expect(screen.getByText(/height:.*máximo/)).toBeDefined();
    expect(stageEl(container)?.style.height).toBe("900px");
  });

  it("stays quiet when every parameter is valid", () => {
    render(<Interactive widget="fake-widget" size="3" />);
    expect(screen.queryByText("Parâmetros ignorados")).toBeNull();
  });

  it("renders the body as the caption, on screen and in print alike", () => {
    const { container } = render(
      <Interactive widget="fake-widget">Uma legenda.</Interactive>,
    );
    // The body is the caption AND the text that stands in for the widget on
    // paper, so it is deliberately rendered in both blocks.
    expect(container.querySelector("figcaption")?.textContent).toBe(
      "Uma legenda.",
    );
    expect(container.querySelector(".print\\:block")?.textContent).toContain(
      "Uma legenda.",
    );
  });

  it("provides a print fallback naming the block", () => {
    const { container } = render(<Interactive widget="fake-widget" />);
    const printBlock = container.querySelector(".print\\:block");
    expect(printBlock?.textContent).toContain("Widget de teste");
    expect(printBlock?.textContent).toContain(
      "Disponível interativamente na versão web.",
    );
  });

  it("prints the poster image when the author supplies one", () => {
    render(<Interactive widget="fake-widget" poster="/media/frame.png" />);
    const img = screen.getByAltText("Widget de teste") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("/media/frame.png");
  });

  it("prints the widget's vector fallback when there is no poster", () => {
    const { container } = render(<Interactive widget="fake-widget" />);
    const printBlock = container.querySelector(".print\\:block");
    expect(
      printBlock?.querySelector("[data-testid='print-fallback']"),
    ).not.toBeNull();
  });

  it("passes the coerced parameters to the print fallback", () => {
    // The paper drawing must reflect this instance, not the widget's defaults.
    render(<Interactive widget="fake-widget" size="4" name="B" />);
    const svg = screen.getByTestId("print-fallback");
    expect(JSON.parse(svg.getAttribute("data-props") || "{}")).toEqual({
      labels: true,
      size: 4,
      name: "B",
    });
  });

  it("lets an author-supplied poster win over the vector fallback", () => {
    render(<Interactive widget="fake-widget" poster="/media/frame.png" />);
    expect(screen.getByAltText("Widget de teste")).toBeDefined();
    expect(screen.queryByTestId("print-fallback")).toBeNull();
  });

  it("still prints title and caption for a widget with no drawing", () => {
    const { container } = render(
      <Interactive widget="print-less">Legenda.</Interactive>,
    );
    const printBlock = container.querySelector(".print\\:block");
    expect(printBlock?.querySelector("svg")).toBeNull();
    expect(printBlock?.textContent).toContain("Widget de teste");
    expect(printBlock?.textContent).toContain("Legenda.");
  });

  it("draws no switcher for a widget that declares no variants", () => {
    render(<Interactive widget="fake-widget" />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // And the widget's signature stays as narrow as it was before.
    expect(widgetKeys()).not.toContain("variant");
  });

  it("draws one button per declared variant", () => {
    render(<Interactive widget="switchy" />);
    const group = screen.getByRole("radiogroup");
    expect(
      within(group)
        .getAllByRole("radio")
        .map((b) => b.textContent),
    ).toEqual(["1D", "2D", "3D"]);
  });

  it("opens on the declared default variant", () => {
    render(<Interactive widget="switchy" />);
    expect(widgetProps().variant).toBe("3d");
    expect(
      screen
        .getByRole("radio", { name: "Ver em 1D" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("opens on the first variant when none is declared as the default", () => {
    render(<Interactive widget="unanchored" />);
    expect(widgetProps().variant).toBe("1d");
  });

  it("hands the widget the variant the reader clicked", () => {
    render(<Interactive widget="switchy" />);
    fireEvent.click(screen.getByText("2D"));
    expect(widgetProps().variant).toBe("2d");
    fireEvent.click(screen.getByText("1D"));
    expect(widgetProps().variant).toBe("1d");
  });

  it("marks only the active button as checked", () => {
    render(<Interactive widget="switchy" />);
    fireEvent.click(screen.getByText("2D"));
    const checked = screen
      .getAllByRole("radio")
      .filter((b) => b.getAttribute("aria-checked") === "true");
    expect(checked.map((b) => b.textContent)).toEqual(["2D"]);
  });

  it("renames the block as the reader switches views", () => {
    render(<Interactive widget="switchy" />);
    expect(screen.getByText("Três dimensões")).toBeDefined();
    fireEvent.click(screen.getByText("1D"));
    expect(screen.getByText("Uma dimensão")).toBeDefined();
    expect(screen.queryByText("Três dimensões")).toBeNull();
  });

  it("lets an authored title outrank the variant's own", () => {
    render(<Interactive widget="switchy" title="Meu título" />);
    fireEvent.click(screen.getByText("1D"));
    expect(screen.getByText("Meu título")).toBeDefined();
    expect(screen.queryByText("Uma dimensão")).toBeNull();
  });

  it("prints the view the reader was looking at", () => {
    render(<Interactive widget="switchy" />);
    fireEvent.click(screen.getByText("2D"));
    const printed = JSON.parse(
      screen.getByTestId("print-fallback").getAttribute("data-props") || "{}",
    );
    expect(printed.variant).toBe("2d");
  });

  it("reports an unknown widget id and lists what exists", () => {
    render(<Interactive widget="nao-existe" />);
    expect(
      screen.getByText(/Interativo desconhecido: "nao-existe"/),
    ).toBeDefined();
    expect(screen.getByText(/fake-widget/)).toBeDefined();
    expect(screen.queryByTestId("widget")).toBeNull();
  });

  it("reports a missing widget id", () => {
    render(<Interactive />);
    expect(screen.getByText(/sem o parâmetro obrigatório/)).toBeDefined();
  });
});
