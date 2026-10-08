/**
 * lib/profile.ts — validation for what a signed-in user edits in /minha-area.
 *
 * Shared by the page (to report before sending) and by the change-password
 * endpoint in collections/Users.ts (which trusts nothing the page checked).
 * Pure: no Payload, no I/O.
 */
import { MAX_NAME_LENGTH } from "./account-request.ts";

export const MIN_PASSWORD_LENGTH = 8;
// Far beyond any real password; only stops a huge body from reaching the
// hashing step.
export const MAX_PASSWORD_LENGTH = 200;

export type Validation<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Checks and trims the display name. */
export function validateProfileName(input: unknown): Validation<string> {
  const name = typeof input === "string" ? input.trim() : "";
  if (!name) return { ok: false, error: "Informe seu nome." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "O nome é longo demais." };
  }
  return { ok: true, data: name };
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

/**
 * Checks an untrusted change-password body. Passwords are not trimmed: a
 * space is a legitimate character in one.
 */
export function validatePasswordChange(
  input: unknown,
): Validation<PasswordChangeData> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const raw = input as Record<string, unknown>;

  const currentPassword =
    typeof raw.currentPassword === "string" ? raw.currentPassword : "";
  if (!currentPassword || currentPassword.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: "Informe sua senha atual." };
  }

  const newPassword =
    typeof raw.newPassword === "string" ? raw.newPassword : "";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: "A nova senha é longa demais." };
  }
  if (newPassword === currentPassword) {
    return {
      ok: false,
      error: "A nova senha precisa ser diferente da atual.",
    };
  }

  return { ok: true, data: { currentPassword, newPassword } };
}
