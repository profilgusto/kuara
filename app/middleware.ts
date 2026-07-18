import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware — protects /aluno and /gestao routes.
 *
 * Uses Payload's JWT cookie (`payload-token`) to verify authentication.
 * If the cookie is missing or invalid, the user is redirected to /login.
 *
 * JWT signature is verified using the Web Crypto API (available in Edge Runtime),
 * so both authenticity and role are checked before granting access.
 */

/**
 * Verifies a JWT's HMAC-SHA256 signature and returns its decoded payload.
 * Throws if the token is malformed or the signature is invalid.
 */
async function verifyJWT(token: string): Promise<Record<string, unknown>> {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error("PAYLOAD_SECRET not configured");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const [headerB64, payloadB64, signatureB64] = parts;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  // Base64url → Uint8Array
  const signatureStr = atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/"));
  const signature = new Uint8Array(signatureStr.length);
  for (let i = 0; i < signatureStr.length; i++) {
    signature[i] = signatureStr.charCodeAt(i);
  }

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!valid) throw new Error("Invalid JWT signature");

  const payloadStr = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(payloadStr) as Record<string, unknown>;
}

/**
 * Ensures the redirect target is a safe relative path.
 * Prevents open-redirect attacks via crafted ?redirect= values.
 */
function sanitizeRedirect(pathname: string): string {
  // Must start with / but not // (protocol-relative URL)
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/";
  }
  return pathname;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("payload-token")?.value;
  const { pathname } = request.nextUrl;

  // No token → redirect to login
  if (!token) {
    // nextUrl.clone() (not `new URL("/login", request.url)`) so the redirect
    // keeps the app's basePath when the app is served under a sub-path.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", sanitizeRedirect(pathname));
    return NextResponse.redirect(loginUrl);
  }

  try {
    const decoded = await verifyJWT(token);

    // /gestao routes require professor or admin role
    if (pathname.startsWith("/gestao")) {
      if (decoded.role !== "professor" && decoded.role !== "admin") {
        const alunoUrl = request.nextUrl.clone();
        alunoUrl.pathname = "/aluno";
        return NextResponse.redirect(alunoUrl);
      }
    }

    // /aluno — any authenticated user is allowed
  } catch {
    // Invalid or tampered token → redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", sanitizeRedirect(pathname));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/aluno/:path*", "/gestao/:path*"],
};
