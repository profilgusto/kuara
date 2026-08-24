/**
 * ImgInline.test.tsx — rendering contract of the inline MDX figure.
 *
 * Doubles as the smoke test for the React half of the suite: if the jsdom
 * environment or the @vitejs/plugin-react transform breaks, this fails first.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ImgInline from "./ImgInline";

describe("ImgInline", () => {
  it("renders nothing when given no source", () => {
    const { container } = render(<ImgInline />);
    expect(container.innerHTML).toBe("");
  });

  it("renders an img from `url`", () => {
    render(<ImgInline url="/media/botao.png" alt="botão salvar" />);
    const img = screen.getByAltText("botão salvar");
    expect(img.getAttribute("src")).toBe("/media/botao.png");
  });

  it("accepts `src` as an interchangeable alias for `url`", () => {
    render(<ImgInline src="/media/botao.png" alt="via src" />);
    expect(screen.getByAltText("via src").getAttribute("src")).toBe(
      "/media/botao.png",
    );
  });

  it("prefers `url` when both are supplied", () => {
    render(<ImgInline url="/media/a.png" src="/media/b.png" alt="ambos" />);
    expect(screen.getByAltText("ambos").getAttribute("src")).toBe(
      "/media/a.png",
    );
  });

  it("defaults alt to an empty string, marking it decorative", () => {
    const { container } = render(<ImgInline url="/media/enfeite.png" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("defaults the height to 1.4em so it tracks the surrounding text", () => {
    const { container } = render(<ImgInline url="/media/a.png" />);
    expect(container.querySelector("img")).toHaveProperty(
      "style.height",
      "1.4em",
    );
  });

  it("treats a numeric height as an em multiple", () => {
    const { container } = render(<ImgInline url="/media/a.png" height={2} />);
    expect(container.querySelector("img")).toHaveProperty(
      "style.height",
      "2em",
    );
  });

  it("treats a bare numeric string as an em multiple too", () => {
    const { container } = render(<ImgInline url="/media/a.png" height="1.6" />);
    expect(container.querySelector("img")).toHaveProperty(
      "style.height",
      "1.6em",
    );
  });

  it("passes an explicit CSS unit through unchanged", () => {
    const { container } = render(
      <ImgInline url="/media/a.png" height="24px" />,
    );
    expect(container.querySelector("img")).toHaveProperty(
      "style.height",
      "24px",
    );
  });

  it("keeps the figure inline with the baseline", () => {
    const { container } = render(<ImgInline url="/media/a.png" />);
    const img = container.querySelector("img")!;
    expect(img.style.display).toBe("inline-block");
    expect(img.style.verticalAlign).toBe("text-bottom");
    expect(img.style.width).toBe("auto");
  });
});
