// @vitest-environment node
/**
 * payload-jwt.test.ts — checking a Payload session token outside Payload.
 *
 * Tokens are forged here with node:crypto, following what Payload does on its
 * side (key = first 32 hex chars of SHA-256(secret), HS256), so the Web Crypto
 * implementation under test is checked against an independent one.
 */
import { describe, it, expect } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { payloadSigningKey, verifyPayloadJWT } from "./payload-jwt";

const SECRET = "devsecret";
const NOW = 1_800_000_000;

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

/** Signs the way Payload does. `key` overrides the derived signing key. */
function sign(claims: Record<string, unknown>, key?: string): string {
  const signingKey =
    key ?? createHash("sha256").update(SECRET).digest("hex").slice(0, 32);
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const signature = createHmac("sha256", signingKey)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${signature}`;
}

describe("payloadSigningKey", () => {
  it("matches Payload's derivation of the configured secret", async () => {
    expect(await payloadSigningKey(SECRET)).toBe(
      createHash("sha256").update(SECRET).digest("hex").slice(0, 32),
    );
    expect(await payloadSigningKey(SECRET)).toHaveLength(32);
  });
});

describe("verifyPayloadJWT", () => {
  it("accepts a token signed by Payload and returns its claims", async () => {
    const token = sign({ id: 7, role: "professor", exp: NOW + 60 });
    expect(await verifyPayloadJWT(token, SECRET, NOW)).toEqual({
      id: 7,
      role: "professor",
      exp: NOW + 60,
    });
  });

  it("keeps non-ASCII claims intact", async () => {
    const token = sign({ name: "João Conceição", exp: NOW + 60 });
    expect((await verifyPayloadJWT(token, SECRET, NOW)).name).toBe(
      "João Conceição",
    );
  });

  it("rejects a token signed with the raw secret", async () => {
    // The mistake this module replaces: Payload never signs with the secret
    // as configured.
    const token = sign({ id: 7, role: "admin", exp: NOW + 60 }, SECRET);
    await expect(verifyPayloadJWT(token, SECRET, NOW)).rejects.toThrow(
      "Invalid JWT signature",
    );
  });

  it("rejects a token whose claims were edited after signing", async () => {
    const [head, , signature] = sign({ role: "student", exp: NOW + 60 }).split(
      ".",
    );
    const forged = b64url(JSON.stringify({ role: "admin", exp: NOW + 60 }));
    await expect(
      verifyPayloadJWT(`${head}.${forged}.${signature}`, SECRET, NOW),
    ).rejects.toThrow("Invalid JWT signature");
  });

  it("rejects a token signed under another secret", async () => {
    const token = sign({ role: "admin", exp: NOW + 60 });
    await expect(verifyPayloadJWT(token, "outro", NOW)).rejects.toThrow(
      "Invalid JWT signature",
    );
  });

  it("rejects an expired token, including at the exact expiry second", async () => {
    await expect(
      verifyPayloadJWT(sign({ role: "admin", exp: NOW - 1 }), SECRET, NOW),
    ).rejects.toThrow("Expired JWT");
    await expect(
      verifyPayloadJWT(sign({ role: "admin", exp: NOW }), SECRET, NOW),
    ).rejects.toThrow("Expired JWT");
  });

  it.each(["", "abc", "a.b", "a.b.c.d"])(
    "rejects the malformed token %j",
    async (token) => {
      await expect(verifyPayloadJWT(token, SECRET, NOW)).rejects.toThrow();
    },
  );
});
