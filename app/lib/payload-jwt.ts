/**
 * lib/payload-jwt.ts — verifies Payload's session token outside Payload.
 *
 * Meant for a Next.js middleware guarding signed-in routes: it uses the Web
 * Crypto API only, so it runs in the Edge runtime. Nothing calls it at the
 * moment — the routes it protected were removed and are being redesigned.
 */

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * The key Payload actually signs with. It is NOT the configured secret: on
 * startup Payload replaces it with the first 32 hex characters of its SHA-256
 * (`payload.secret`, see payload/dist/index.js). Verifying against the raw
 * PAYLOAD_SECRET rejects every genuine token.
 */
export async function payloadSigningKey(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return toHex(digest).slice(0, 32);
}

/**
 * Verifies a Payload JWT (HS256) and returns its claims.
 * Throws if the token is malformed, not signed by `secret`, or expired.
 *
 * `nowSeconds` exists for tests; callers leave it out.
 */
export async function verifyPayloadJWT(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [headerB64, payloadB64, signatureB64] = parts;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(await payloadSigningKey(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signatureB64),
    encoder.encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) throw new Error("Invalid JWT signature");

  const claims = JSON.parse(
    new TextDecoder().decode(fromBase64Url(payloadB64)),
  ) as Record<string, unknown>;

  if (typeof claims.exp === "number" && claims.exp <= nowSeconds) {
    throw new Error("Expired JWT");
  }
  return claims;
}
