/**
 * slides.test.ts — extractSlideCoverProps, which feeds the presentation cover.
 *
 * The extractor runs against raw MDX source (before parsing), so it has to
 * tolerate the formatting variations authors actually produce.
 */
import { describe, it, expect } from "vitest";
import { extractSlideCoverProps } from "./slides";

describe("extractSlideCoverProps", () => {
  it("returns null when the deck has no cover", () => {
    expect(extractSlideCoverProps("# Slide comum")).toBeNull();
  });

  it("extracts every supported prop", () => {
    const mdx = `<SlideCover
      title="Cinemática"
      subtitle="Aula 3"
      author="Prof. Filipe"
      date="2026-08-24"
      backgroundImage="/media/fundo.png"
      logoImage="/media/logo.png"
    />`;
    expect(extractSlideCoverProps(mdx)).toEqual({
      title: "Cinemática",
      subtitle: "Aula 3",
      author: "Prof. Filipe",
      date: "2026-08-24",
      backgroundImage: "/media/fundo.png",
      logoImage: "/media/logo.png",
    });
  });

  it("leaves omitted props undefined rather than empty strings", () => {
    const props = extractSlideCoverProps('<SlideCover title="Só o título" />');
    expect(props).not.toBeNull();
    expect(props!.title).toBe("Só o título");
    expect(props!.subtitle).toBeUndefined();
    expect(props!.author).toBeUndefined();
  });

  it("accepts single-quoted attribute values", () => {
    expect(
      extractSlideCoverProps("<SlideCover title='Cinemática' />")?.title,
    ).toBe("Cinemática");
  });

  it("reads an explicitly empty attribute as an empty string", () => {
    expect(extractSlideCoverProps('<SlideCover title="" />')?.title).toBe("");
  });

  it("handles the non-self-closing form <SlideCover ...>", () => {
    expect(extractSlideCoverProps('<SlideCover title="Aberta">')?.title).toBe(
      "Aberta",
    );
  });

  it("reads props spread across multiple lines", () => {
    const mdx = '<SlideCover\n  title="Multilinha"\n  author="Alguém"\n/>';
    const props = extractSlideCoverProps(mdx);
    expect(props?.title).toBe("Multilinha");
    expect(props?.author).toBe("Alguém");
  });

  it("uses the first cover when a deck mistakenly declares two", () => {
    const mdx =
      '<SlideCover title="Primeira" />\n<SlideCover title="Segunda" />';
    expect(extractSlideCoverProps(mdx)?.title).toBe("Primeira");
  });
});
