/**
 * profile.test.ts — the checks behind /minha-area. The password one also
 * guards the change-password endpoint, so the hostile shapes are spelled out.
 */
import { describe, it, expect } from "vitest";
import { MAX_NAME_LENGTH } from "./account-request";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordChange,
  validateProfileName,
} from "./profile";

describe("validateProfileName", () => {
  it("accepts a name and trims it", () => {
    expect(validateProfileName("  Ana Souza ")).toEqual({
      ok: true,
      data: "Ana Souza",
    });
  });

  it.each(["", "   ", undefined, null, 42, { name: "Ana" }])(
    "refuses %j as a name",
    (input) => {
      expect(validateProfileName(input)).toEqual({
        ok: false,
        error: "Informe seu nome.",
      });
    },
  );

  it("accepts a name at the limit and refuses one past it", () => {
    expect(validateProfileName("a".repeat(MAX_NAME_LENGTH)).ok).toBe(true);
    expect(validateProfileName("a".repeat(MAX_NAME_LENGTH + 1))).toEqual({
      ok: false,
      error: "O nome é longo demais.",
    });
  });
});

describe("validatePasswordChange", () => {
  const valid = { currentPassword: "antiga123", newPassword: "nova-senha" };

  it("accepts a complete change", () => {
    expect(validatePasswordChange(valid)).toEqual({ ok: true, data: valid });
  });

  it("keeps spaces in passwords and drops unknown keys", () => {
    const result = validatePasswordChange({
      currentPassword: " antiga 123 ",
      newPassword: "  nova senha  ",
      role: "admin",
    });
    expect(result).toEqual({
      ok: true,
      data: { currentPassword: " antiga 123 ", newPassword: "  nova senha  " },
    });
  });

  it.each([null, undefined, "texto", 7, [valid]])(
    "refuses the body %j",
    (body) => {
      expect(validatePasswordChange(body)).toEqual({
        ok: false,
        error: "Dados inválidos.",
      });
    },
  );

  it.each([undefined, "", 123, "x".repeat(MAX_PASSWORD_LENGTH + 1)])(
    "asks for the current password when it is %j",
    (currentPassword) => {
      expect(validatePasswordChange({ ...valid, currentPassword })).toEqual({
        ok: false,
        error: "Informe sua senha atual.",
      });
    },
  );

  it("accepts a new password at the minimum and refuses one below it", () => {
    expect(
      validatePasswordChange({
        ...valid,
        newPassword: "n".repeat(MIN_PASSWORD_LENGTH),
      }).ok,
    ).toBe(true);
    expect(
      validatePasswordChange({
        ...valid,
        newPassword: "n".repeat(MIN_PASSWORD_LENGTH - 1),
      }),
    ).toEqual({
      ok: false,
      error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    });
  });

  it.each([undefined, 12345678, ["nova-senha"]])(
    "refuses a new password that is %j",
    (newPassword) => {
      expect(validatePasswordChange({ ...valid, newPassword }).ok).toBe(false);
    },
  );

  it("refuses a new password past the limit", () => {
    expect(
      validatePasswordChange({
        ...valid,
        newPassword: "n".repeat(MAX_PASSWORD_LENGTH + 1),
      }),
    ).toEqual({ ok: false, error: "A nova senha é longa demais." });
  });

  it("refuses a new password equal to the current one", () => {
    expect(
      validatePasswordChange({
        currentPassword: "mesma-senha",
        newPassword: "mesma-senha",
      }),
    ).toEqual({
      ok: false,
      error: "A nova senha precisa ser diferente da atual.",
    });
  });
});
