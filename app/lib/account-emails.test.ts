/**
 * account-emails.test.ts — the link and body of the "set your password"
 * e-mail. A wrong URL here strands every recovery and every approved account,
 * and it only shows up in production, where the app lives under /kuara.
 */
import { describe, it, expect } from "vitest";
import {
  passwordEmailHtml,
  passwordEmailSubject,
  passwordLinkUrl,
} from "./account-emails";

describe("passwordLinkUrl", () => {
  it("builds the dev URL", () => {
    expect(passwordLinkUrl("http://localhost:3000", "abc123")).toBe(
      "http://localhost:3000/redefinir-senha?token=abc123",
    );
  });

  it("keeps the basePath that the production server URL carries", () => {
    expect(passwordLinkUrl("https://kuara.ufsj.edu.br/kuara", "abc123")).toBe(
      "https://kuara.ufsj.edu.br/kuara/redefinir-senha?token=abc123",
    );
  });

  it("does not double the slash when the server URL ends in one", () => {
    expect(passwordLinkUrl("https://kuara.ufsj.edu.br/kuara/", "abc")).toBe(
      "https://kuara.ufsj.edu.br/kuara/redefinir-senha?token=abc",
    );
  });

  it("encodes the token", () => {
    expect(passwordLinkUrl("http://x", "a b&c")).toBe(
      "http://x/redefinir-senha?token=a%20b%26c",
    );
  });
});

describe("passwordEmailSubject", () => {
  it("differs between recovery and approval", () => {
    expect(passwordEmailSubject(false)).toBe("Kuara — redefinição de senha");
    expect(passwordEmailSubject(true)).toBe("Kuara — sua conta foi aprovada");
  });
});

describe("passwordEmailHtml", () => {
  const base = { token: "tok", serverUrl: "http://localhost:3000" };

  it("links to the password page", () => {
    const html = passwordEmailHtml({ ...base, name: "Ana", welcome: false });
    expect(html).toContain(
      '<a href="http://localhost:3000/redefinir-senha?token=tok"',
    );
    expect(html).toContain("Olá, Ana.");
  });

  it("states the right validity for each kind of message", () => {
    expect(passwordEmailHtml({ ...base, welcome: false })).toContain("1 hora");
    expect(passwordEmailHtml({ ...base, welcome: true })).toContain("7 dias");
    expect(passwordEmailHtml({ ...base, welcome: true })).toContain(
      "foi aprovada",
    );
  });

  it("gives each kind of message its own heading and button", () => {
    const recovery = passwordEmailHtml({ ...base, welcome: false });
    expect(recovery).toContain("Redefinição de senha</h1>");
    expect(recovery).toContain(">Escolher nova senha</a>");
    const welcome = passwordEmailHtml({ ...base, welcome: true });
    expect(welcome).toContain("Sua conta foi aprovada</h1>");
    expect(welcome).toContain(">Definir minha senha</a>");
  });

  it("comes wrapped in the shared Kuara layout", () => {
    const html = passwordEmailHtml({ ...base, welcome: false });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Saber irradia de dentro");
  });

  it("greets without a name when there is none", () => {
    expect(
      passwordEmailHtml({ ...base, name: null, welcome: false }),
    ).toContain(">Olá.</p>");
  });

  it("escapes a name that carries markup", () => {
    const html = passwordEmailHtml({
      ...base,
      name: '<img src=x onerror="alert(1)">',
      welcome: true,
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
