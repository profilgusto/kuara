/**
 * lib/account-request.ts — validation and throttling for the public
 * "request an account" form.
 *
 * The endpoint that uses these (collections/AccountRequests.ts) is reachable
 * without a session, so everything it accepts passes through here first.
 * Pure: no Payload, no I/O.
 */

export const REQUESTABLE_ROLES = ["student", "professor"] as const;
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_MESSAGE_LENGTH = 1000;

export interface AccountRequestData {
  name: string;
  email: string;
  requestedRole: RequestableRole;
  message: string;
}

export type AccountRequestValidation =
  | { ok: true; data: AccountRequestData }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks and normalises an untrusted request body. Unknown keys are dropped:
 * the result carries only the four fields above, so a crafted payload cannot
 * set `status` or any other column.
 */
export function validateAccountRequest(
  input: unknown,
): AccountRequestValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const raw = input as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "Informe seu nome." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "O nome é longo demais." };
  }

  const email =
    typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, error: "Informe um e-mail válido." };
  }

  const requestedRole = REQUESTABLE_ROLES.find((r) => r === raw.requestedRole);
  if (!requestedRole) {
    return { ok: false, error: "Escolha o perfil da conta." };
  }

  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `A mensagem pode ter até ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
  }

  return { ok: true, data: { name, email, requestedRole, message } };
}

/**
 * The caller's address behind the reverse proxy. Traefik APPENDS the address
 * it saw to X-Forwarded-For, so the first entry is whatever the client chose
 * to send and the last one is the only one that can be trusted. Reading the
 * first would let a caller dodge the rate limit by varying the header.
 */
export function clientIp(forwardedFor: string | null | undefined): string {
  const last = forwardedFor?.split(",").at(-1)?.trim();
  return last || "unknown";
}

/**
 * Fixed-window counter keyed by caller (an IP address). In-memory, which is
 * enough for the single web container Kuara runs; it resets on restart.
 */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    /** Records an attempt and reports whether it is within the limit. */
    allow(key: string, now: number = Date.now()): boolean {
      // Drop expired windows so the map cannot grow without bound.
      for (const [k, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(k);
      }
      const entry = hits.get(key);
      if (!entry) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
  };
}
