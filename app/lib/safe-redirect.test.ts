/**
 * safe-redirect.test.ts — open-redirect guard on the ?redirect= parameter.
 *
 * This is the check standing between a crafted link and an attacker-controlled
 * destination after login, so the hostile inputs are enumerated explicitly.
 */
import { describe, it, expect } from "vitest";
import { sanitizeRedirect } from "./safe-redirect";

describe("sanitizeRedirect", () => {
  it("passes through an ordinary relative path", () => {
    expect(sanitizeRedirect("/aluno/modulos")).toBe("/aluno/modulos");
  });

  it("preserves query strings and fragments on a relative path", () => {
    expect(sanitizeRedirect("/aluno?tab=notas#topo")).toBe(
      "/aluno?tab=notas#topo",
    );
  });

  it("rejects a protocol-relative URL", () => {
    // "//evil.com" is a fully qualified URL to the browser — the core bypass.
    expect(sanitizeRedirect("//evil.com")).toBe("/");
    expect(sanitizeRedirect("//evil.com/phishing")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeRedirect("https://evil.com")).toBe("/");
    expect(sanitizeRedirect("http://evil.com")).toBe("/");
  });

  it("rejects a javascript: payload", () => {
    expect(sanitizeRedirect("javascript:alert(1)")).toBe("/");
  });

  it("rejects paths that do not start with a slash", () => {
    expect(sanitizeRedirect("aluno")).toBe("/");
    expect(sanitizeRedirect("")).toBe("/");
  });

  it("keeps the bare root path", () => {
    expect(sanitizeRedirect("/")).toBe("/");
  });
});
