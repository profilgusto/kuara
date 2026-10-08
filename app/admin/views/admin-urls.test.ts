import { describe, expect, it, afterEach, vi } from "vitest";
import { formatAdminURL } from "payload/shared";

/**
 * Guards the basePath contract the custom admin views rely on.
 *
 * `useConfig().config.routes` is basePath-RELATIVE ("/api", "/payload" — see
 * payload.config.ts), so a raw `fetch(`${api}/modules`)` from an admin view
 * hits /api/modules. In production Traefik only routes /kuara and /media, so
 * that request 404s before it reaches the app and the view renders empty —
 * exactly the "Nenhum módulo encontrado" bug on the reorder screen, which
 * never shows up locally because BASE_PATH is "".
 *
 * formatAdminURL applies process.env.NEXT_BASE_PATH, which withPayload()
 * inlines into the client bundle from next.config.mjs's basePath.
 */
const apiRoute = "/api";
const adminRoute = "/payload";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin view URLs under a basePath", () => {
  it("prefixes API calls in production", () => {
    vi.stubEnv("NEXT_BASE_PATH", "/kuara");
    expect(formatAdminURL({ apiRoute, path: "/modules?limit=100" })).toBe(
      "/kuara/api/modules?limit=100",
    );
  });

  it("prefixes plain <a> admin links only when asked", () => {
    vi.stubEnv("NEXT_BASE_PATH", "/kuara");
    // A Next <Link> gets the prefix from the router, so the default is bare.
    expect(formatAdminURL({ adminRoute, path: "/collections/modules/7" })).toBe(
      "/payload/collections/modules/7",
    );
    // A raw <a href> has nothing downstream to prefix it.
    expect(
      formatAdminURL({
        adminRoute,
        path: "/collections/modules/7",
        includeBasePath: true,
      }),
    ).toBe("/kuara/payload/collections/modules/7");
  });

  it("is a no-op in development, where there is no basePath", () => {
    vi.stubEnv("NEXT_BASE_PATH", "");
    expect(formatAdminURL({ apiRoute, path: "/modules?limit=100" })).toBe(
      "/api/modules?limit=100",
    );
    expect(
      formatAdminURL({
        adminRoute,
        path: "/collections/modules/7",
        includeBasePath: true,
      }),
    ).toBe("/payload/collections/modules/7");
  });
});
