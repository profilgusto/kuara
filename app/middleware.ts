import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware — protects /aluno and /gestao routes.
 *
 * Uses Payload's JWT cookie (`payload-token`) to verify authentication.
 * If the cookie is missing, the user is redirected to /login.
 *
 * NOTE: We do NOT verify the JWT signature here (that would need the secret
 * in edge runtime). Instead, we simply check for the presence of the cookie
 * and decode its payload to check the role. The actual security enforcement
 * happens server-side when the page fetches data via Payload's Local API,
 * which validates the token fully.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get("payload-token")?.value;
  const { pathname } = request.nextUrl;

  // If accessing a protected route without a token, redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode JWT payload (base64) to check role — no verification needed here
  try {
    const payloadPart = token.split(".")[1];
    const decoded = JSON.parse(
      Buffer.from(payloadPart, "base64").toString("utf-8"),
    );

    // /gestao routes require professor or admin role
    if (pathname.startsWith("/gestao")) {
      if (decoded.role !== "professor" && decoded.role !== "admin") {
        return NextResponse.redirect(new URL("/aluno", request.url));
      }
    }

    // /aluno routes require student (or any authenticated user)
    // No additional role check needed — any logged-in user can access /aluno
  } catch {
    // If token decoding fails, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/aluno/:path*", "/gestao/:path*"],
};
