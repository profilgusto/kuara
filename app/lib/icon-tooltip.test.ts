/**
 * icon-tooltip.test.ts — which elements get the instant tooltip, and where
 * it lands.
 */
import { describe, it, expect } from "vitest";
import {
  HELD_TITLE,
  TOOLTIP_TARGETS,
  placeTooltip,
  tooltipLabelFor,
} from "./icon-tooltip";

/** Builds the element described by an HTML snippet. */
function el(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild!;
}

describe("tooltip targets", () => {
  it("include a table heading that carries data-tooltip", () => {
    // A heading only parses inside a table.
    const heading = (attrs: string) =>
      el(`<table><tr><th ${attrs}>P1</th></tr></table>`).querySelector("th")!;
    const th = heading('data-tooltip="Prova prática"');
    expect(th.matches(TOOLTIP_TARGETS)).toBe(true);
    expect(tooltipLabelFor(th)).toBe("Prova prática");
    expect(heading("").matches(TOOLTIP_TARGETS)).toBe(false);
  });
});

describe("tooltipLabelFor", () => {
  it("describes an icon-only button by its aria-label", () => {
    expect(
      tooltipLabelFor(
        el('<button aria-label="Alternar tema"><svg></svg></button>'),
      ),
    ).toBe("Alternar tema");
  });

  it("falls back to the title, including one set aside while showing", () => {
    expect(
      tooltipLabelFor(el('<button title="Baixar PDF"><svg></svg></button>')),
    ).toBe("Baixar PDF");
    expect(
      tooltipLabelFor(
        el(`<button ${HELD_TITLE}="Baixar PDF"><svg></svg></button>`),
      ),
    ).toBe("Baixar PDF");
  });

  it("prefers the aria-label over the title", () => {
    expect(
      tooltipLabelFor(
        el('<button aria-label="Editar" title="outro"></button>'),
      ),
    ).toBe("Editar");
  });

  it("leaves a button with visible words alone", () => {
    expect(
      tooltipLabelFor(
        el('<button aria-label="Ordenar por nome">Nome <svg></svg></button>'),
      ),
    ).toBeNull();
    expect(tooltipLabelFor(el("<button>Salvar</button>"))).toBeNull();
  });

  it("does not count screen-reader-only or hidden text as visible", () => {
    expect(
      tooltipLabelFor(
        el(
          '<button aria-label="Fechar"><svg></svg><span class="sr-only">Close</span></button>',
        ),
      ),
    ).toBe("Fechar");
    expect(
      tooltipLabelFor(
        el(
          '<button aria-label="Fechar"><span aria-hidden="true">×</span></button>',
        ),
      ),
    ).toBe("Fechar");
  });

  it("has nothing to say about an unnamed or disabled button", () => {
    expect(tooltipLabelFor(el("<button><svg></svg></button>"))).toBeNull();
    expect(tooltipLabelFor(el('<button aria-label="  "></button>'))).toBeNull();
    expect(
      tooltipLabelFor(el('<button aria-label="Salvar" disabled></button>')),
    ).toBeNull();
  });

  it("lets an element ask for a tooltip, or refuse one", () => {
    expect(
      tooltipLabelFor(
        el('<button data-tooltip="Cria uma oferta">Criar</button>'),
      ),
    ).toBe("Cria uma oferta");
    expect(
      tooltipLabelFor(
        el('<button aria-label="Editar" data-tooltip="off"></button>'),
      ),
    ).toBeNull();
  });
});

describe("placeTooltip", () => {
  const viewport = { width: 1000, height: 600 };
  const size = { width: 100, height: 24 };

  it("centres the tooltip under the button", () => {
    expect(
      placeTooltip(
        { left: 480, top: 100, width: 40, height: 40 },
        size,
        viewport,
      ),
    ).toEqual({ left: 450, top: 146, side: "bottom" });
  });

  it("flips above when there is no room below", () => {
    expect(
      placeTooltip(
        { left: 480, top: 560, width: 40, height: 30 },
        size,
        viewport,
      ),
    ).toEqual({ left: 450, top: 530, side: "top" });
  });

  it("stays below when there is no room above either", () => {
    const tall = { width: 100, height: 400 };
    expect(
      placeTooltip(
        { left: 480, top: 300, width: 40, height: 30 },
        tall,
        viewport,
      ).side,
    ).toBe("bottom");
  });

  it("slides in from the right and left edges", () => {
    expect(
      placeTooltip(
        { left: 970, top: 10, width: 24, height: 24 },
        size,
        viewport,
      ).left,
    ).toBe(894);
    expect(
      placeTooltip({ left: 2, top: 10, width: 24, height: 24 }, size, viewport)
        .left,
    ).toBe(6);
  });

  it("keeps to the left margin when wider than the screen", () => {
    expect(
      placeTooltip(
        { left: 100, top: 10, width: 24, height: 24 },
        { width: 2000, height: 24 },
        viewport,
      ).left,
    ).toBe(6);
  });
});
