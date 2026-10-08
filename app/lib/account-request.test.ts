/**
 * account-request.test.ts — the guard in front of the public account-request
 * endpoint. Everything a visitor can send goes through these two functions,
 * so the hostile shapes are spelled out.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  clientIp,
  createRateLimiter,
  validateAccountRequest,
} from "./account-request";

const valid = {
  name: "Ana Souza",
  email: "ana@ufsj.edu.br",
  requestedRole: "student",
  message: "Turma de Robótica 2026.2",
};

describe("validateAccountRequest", () => {
  it("accepts a complete request", () => {
    expect(validateAccountRequest(valid)).toEqual({ ok: true, data: valid });
  });

  it("trims fields and lower-cases the e-mail", () => {
    const result = validateAccountRequest({
      ...valid,
      name: "  Ana Souza ",
      email: "  Ana@UFSJ.edu.br ",
      message: "  oi  ",
    });
    expect(result).toEqual({
      ok: true,
      data: { ...valid, message: "oi" },
    });
  });

  it("treats a missing message as empty", () => {
    const result = validateAccountRequest({
      name: valid.name,
      email: valid.email,
      requestedRole: valid.requestedRole,
    });
    expect(result.ok && result.data.message).toBe("");
  });

  it("drops fields the form does not have", () => {
    const result = validateAccountRequest({
      ...valid,
      status: "approved",
      role: "admin",
    });
    expect(result).toEqual({ ok: true, data: valid });
  });

  it("refuses the admin role", () => {
    expect(
      validateAccountRequest({ ...valid, requestedRole: "admin" }),
    ).toEqual({ ok: false, error: "Escolha o perfil da conta." });
  });

  it.each([null, undefined, "texto", 42, [valid]])(
    "refuses a non-object body (%j)",
    (body) => {
      expect(validateAccountRequest(body).ok).toBe(false);
    },
  );

  it.each(["", "   ", 123, null])("refuses the name %j", (name) => {
    expect(validateAccountRequest({ ...valid, name })).toEqual({
      ok: false,
      error: "Informe seu nome.",
    });
  });

  it.each(["", "ana", "ana@", "@ufsj.edu.br", "ana@ufsj", "a b@ufsj.edu.br"])(
    "refuses the e-mail %j",
    (email) => {
      expect(validateAccountRequest({ ...valid, email })).toEqual({
        ok: false,
        error: "Informe um e-mail válido.",
      });
    },
  );

  it("refuses an over-long name or message", () => {
    expect(
      validateAccountRequest({
        ...valid,
        name: "a".repeat(MAX_NAME_LENGTH + 1),
      }).ok,
    ).toBe(false);
    expect(
      validateAccountRequest({
        ...valid,
        message: "a".repeat(MAX_MESSAGE_LENGTH + 1),
      }).ok,
    ).toBe(false);
    expect(
      validateAccountRequest({
        ...valid,
        message: "a".repeat(MAX_MESSAGE_LENGTH),
      }).ok,
    ).toBe(true);
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit and blocks the next attempt", () => {
    const limiter = createRateLimiter(2, 1000);
    expect(limiter.allow("1.1.1.1", 0)).toBe(true);
    expect(limiter.allow("1.1.1.1", 10)).toBe(true);
    expect(limiter.allow("1.1.1.1", 20)).toBe(false);
  });

  it("counts each caller separately", () => {
    const limiter = createRateLimiter(1, 1000);
    expect(limiter.allow("1.1.1.1", 0)).toBe(true);
    expect(limiter.allow("2.2.2.2", 0)).toBe(true);
    expect(limiter.allow("1.1.1.1", 1)).toBe(false);
  });

  it("opens a fresh window once the old one has passed", () => {
    const limiter = createRateLimiter(1, 1000);
    expect(limiter.allow("1.1.1.1", 0)).toBe(true);
    expect(limiter.allow("1.1.1.1", 999)).toBe(false);
    expect(limiter.allow("1.1.1.1", 1000)).toBe(true);
  });
});

describe("clientIp", () => {
  it("trusts the entry the proxy appended, not the first one", () => {
    expect(clientIp("6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("1.1.1.1, 2.2.2.2, 203.0.113.9")).toBe("203.0.113.9");
  });
  it("handles a single address and missing header", () => {
    expect(clientIp("203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp(null)).toBe("unknown");
    expect(clientIp("")).toBe("unknown");
    expect(clientIp(" , ")).toBe("unknown");
  });
});
