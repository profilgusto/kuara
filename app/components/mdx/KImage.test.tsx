/**
 * KImage.test.tsx — figure layout.
 *
 * The caption used to live inside a shrink-to-fit column alongside the image
 * and carried an inline `max-width` copied from the image's width, so a narrow
 * figure produced a narrow, heavily wrapped caption. It now runs the full
 * width of the text column, like a paragraph.
 *
 * jsdom computes no layout, so these assert the structure that produces the
 * width rather than the width itself: the caption is a sibling of the image
 * row, not a child of it, and nothing caps it.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import KImage from "./KImage";
import { FiguresProvider } from "@/components/figures/FiguresProvider";

function figure(ui: React.ReactElement) {
  const { container } = render(ui);
  const caption = container.querySelector("figcaption");
  if (!caption) throw new Error("figure rendered without a caption");
  return { container, caption, img: container.querySelector("img") };
}

describe("KImage caption width", () => {
  it("does not cap the caption at the image width", () => {
    const { caption } = figure(
      <KImage url="/api/media/file/a.png" width={320} caption="Uma legenda." />,
    );
    expect(caption.getAttribute("style")).toBeNull();
    expect(caption.className).toContain("w-full");
  });

  it("keeps the caption out of the image's shrink-to-fit row", () => {
    const { caption, img } = figure(
      <KImage url="/api/media/file/a.png" width={320} caption="Uma legenda." />,
    );
    // Sibling, not descendant: a caption inside the image's row would be
    // bounded by it however wide the text column is.
    expect(img && caption.contains(img)).toBe(false);
    expect(img?.parentElement?.contains(caption)).toBe(false);
    expect(caption.parentElement).toBe(img?.parentElement?.parentElement);
  });

  it("still constrains the image itself, not the caption", () => {
    const { img } = figure(
      <KImage url="/api/media/file/a.png" width={320} caption="Uma legenda." />,
    );
    expect(img?.getAttribute("style")).toContain("320px");
  });

  it.each([
    ["center", "text-center"],
    ["left", "text-left"],
    ["right", "text-right"],
  ] as const)("keeps %s alignment on the caption text", (align, cls) => {
    const { caption } = figure(
      <KImage url="/api/media/file/a.png" align={align} caption="Legenda." />,
    );
    expect(caption.className).toContain(cls);
  });

  it("renders no caption element when there is nothing to say", () => {
    const { container } = render(<KImage url="/api/media/file/a.png" />);
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("stacks the image row above the caption", () => {
    const { caption } = figure(
      <KImage url="/api/media/file/a.png" caption="Uma legenda." />,
    );
    // Without this the two become columns of one row, and the caption is
    // squeezed beside the image instead of running under it.
    expect(caption.parentElement?.className).toContain("flex-col");
  });

  it("numbers the figure and keeps the number in the caption", () => {
    const { container } = render(
      <FiguresProvider figureOrder={["primeira", "mao-direita"]}>
        <KImage
          url="/api/media/file/a.png"
          label="mao-direita"
          caption="Uma legenda."
        />
      </FiguresProvider>,
    );
    const caption = container.querySelector("figcaption");
    expect(caption?.textContent).toContain("Fig. 2");
    expect(caption?.textContent).toContain("Uma legenda.");
  });

  it("keeps the anchor id on the figure wrapper", () => {
    const { container } = render(
      <KImage url="/api/media/file/a.png" label="mao-direita" caption="x" />,
    );
    expect(container.querySelector("#fig-mao-direita")).not.toBeNull();
  });
});

/**
 * `widthPresentation="auto"` takes a separate render path that sizes the image
 * against the slide. It had the same caption problem and needs the same
 * guarantee — measurement itself belongs to the browser, so only the structure
 * is asserted here.
 */
describe("KImage caption width — auto mode", () => {
  beforeEach(() => {
    localStorage.setItem("view-mode", "apresentacao");
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("gives the caption the full width there too", () => {
    const { container } = render(
      <KImage
        url="/api/media/file/a.png"
        widthPresentation="auto"
        caption="Uma legenda."
      />,
    );
    const caption = container.querySelector("figcaption");
    expect(caption?.getAttribute("style")).toBeNull();
    expect(caption?.className).toContain("w-full");
    expect(caption?.parentElement?.className).toContain("flex-col");
    expect(
      container.querySelector("img")?.parentElement?.contains(caption!),
    ).toBe(false);
  });
});
