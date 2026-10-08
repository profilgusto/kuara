/**
 * email-layout.test.ts — the shell every Kuara e-mail is wrapped in.
 *
 * Besides the look, these helpers are the escaping boundary: callers hand
 * them plain text (names typed into a public form, URLs carrying tokens), so
 * each one is checked against markup in its input.
 */
import { describe, it, expect } from "vitest";
import {
  EMAIL_TAGLINE,
  emailButton,
  emailNote,
  emailParagraph,
  emailShell,
  escapeHtml,
} from "./email-layout";

const HOSTILE = '<script>alert("x")</script> & co';
const ESCAPED = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co";

describe("escapeHtml", () => {
  it("escapes the ampersand first, so entities are not double-escaped", () => {
    expect(escapeHtml(`a & b < c > "d"`)).toBe(
      "a &amp; b &lt; c &gt; &quot;d&quot;",
    );
  });
});

describe("emailParagraph", () => {
  it("wraps text in a styled paragraph", () => {
    expect(emailParagraph("Olá.")).toMatch(/^<p style="[^"]+">Olá\.<\/p>$/);
  });

  it("escapes its text", () => {
    const html = emailParagraph(HOSTILE);
    expect(html).toContain(ESCAPED);
    expect(html).not.toContain("<script>");
  });
});

describe("emailNote", () => {
  it("escapes its text", () => {
    expect(emailNote(HOSTILE)).toContain(ESCAPED);
    expect(emailNote(HOSTILE)).not.toContain("<script>");
  });
});

describe("emailButton", () => {
  const url = "https://kuara.ufsj.edu.br/kuara/redefinir-senha?token=abc";

  it("links the label to the address", () => {
    const html = emailButton(url, "Definir minha senha");
    expect(html).toContain(`<a href="${url}"`);
    expect(html).toContain(">Definir minha senha</a>");
  });

  it("repeats the address as text, for clients that drop the button", () => {
    const html = emailButton(url, "Abrir");
    expect(html.split(url)).toHaveLength(3); // href + visible copy
  });

  it("escapes an address that would break out of the attribute", () => {
    const html = emailButton('http://x/?a=1&b="><script>', "Abrir");
    expect(html).toContain(
      'href="http://x/?a=1&amp;b=&quot;&gt;&lt;script&gt;"',
    );
    expect(html).not.toContain("<script>");
  });

  it("escapes the label", () => {
    expect(emailButton(url, HOSTILE)).toContain(ESCAPED);
  });
});

describe("emailShell", () => {
  const html = emailShell({
    title: "Redefinição de senha",
    preview: "Use o link.",
    bodyHtml: "<p>corpo</p>",
  });

  it("is a complete Portuguese document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("carries the wordmark, the tagline and the footer", () => {
    expect(html).toContain(">Kuara</span>");
    expect(html).toContain(EMAIL_TAGLINE);
    expect(html).toContain("Engenharia Mecatrônica · UFSJ");
  });

  it("shows the title as heading and document title", () => {
    expect(html).toContain("<title>Redefinição de senha</title>");
    expect(html).toMatch(/<h1 [^>]+>Redefinição de senha<\/h1>/);
  });

  it("includes the body as given and the preview hidden", () => {
    expect(html).toContain("<p>corpo</p>");
    expect(html).toMatch(/<div style="display:none[^"]*">Use o link\.<\/div>/);
  });

  it("uses only inline styles and tables, as e-mail clients require", () => {
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
    expect(html).not.toMatch(/hsl\(|var\(/);
  });

  it("escapes the title and the preview", () => {
    const hostile = emailShell({
      title: HOSTILE,
      preview: HOSTILE,
      bodyHtml: "",
    });
    expect(hostile).not.toContain("<script>");
    expect(hostile.split(ESCAPED)).toHaveLength(4); // <title>, preview, <h1>
  });
});
