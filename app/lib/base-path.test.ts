/**
 * base-path.test.ts — the /kuara sub-path helpers.
 *
 * These guard the basePath migration (commits 6c47a43..ef405b3): a regression
 * here produces either double-prefixed URLs (/kuara/kuara/...) or unprefixed
 * ones that 404 behind the Traefik PathPrefix router.
 *
 * BASE_PATH is read once at module load, so each case re-imports the module
 * under a stubbed env instead of mutating an already-bound constant.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

async function loadWithBasePath(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", value);
  return import("./base-path");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("BASE_PATH", () => {
  it("is empty when NEXT_PUBLIC_BASE_PATH is unset (dev default)", async () => {
    const { BASE_PATH } = await loadWithBasePath(undefined);
    expect(BASE_PATH).toBe("");
  });

  it("mirrors NEXT_PUBLIC_BASE_PATH when set (production)", async () => {
    const { BASE_PATH } = await loadWithBasePath("/kuara");
    expect(BASE_PATH).toBe("/kuara");
  });
});

describe("comBasePath", () => {
  it("passes paths through untouched with no base path", async () => {
    const { comBasePath } = await loadWithBasePath(undefined);
    expect(comBasePath("/api/health")).toBe("/api/health");
  });

  it("prefixes paths when served under a sub-path", async () => {
    const { comBasePath } = await loadWithBasePath("/kuara");
    expect(comBasePath("/api/health")).toBe("/kuara/api/health");
    expect(comBasePath("/login")).toBe("/kuara/login");
  });

  it("prefixes the root path without collapsing it to the bare prefix", async () => {
    const { comBasePath } = await loadWithBasePath("/kuara");
    expect(comBasePath("/")).toBe("/kuara/");
  });
});

describe("resolveMediaUrl", () => {
  it("prefixes /api/* — Payload media routes live behind the basePath", async () => {
    const { resolveMediaUrl } = await loadWithBasePath("/kuara");
    expect(resolveMediaUrl("/api/media/file/diagrama.png")).toBe(
      "/kuara/api/media/file/diagrama.png",
    );
  });

  it("leaves /media/* unprefixed — Traefik routes it at the domain root", async () => {
    // Content authored before the /kuara move stores bare /media URLs in the
    // database; next.config.mjs rewrites them with basePath:false to match.
    const { resolveMediaUrl } = await loadWithBasePath("/kuara");
    expect(resolveMediaUrl("/media/diagrama.png")).toBe("/media/diagrama.png");
  });

  it("leaves absolute URLs and data URIs alone", async () => {
    const { resolveMediaUrl } = await loadWithBasePath("/kuara");
    expect(resolveMediaUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(resolveMediaUrl("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
  });

  it("is a no-op in dev, where there is no base path", async () => {
    const { resolveMediaUrl } = await loadWithBasePath(undefined);
    expect(resolveMediaUrl("/api/media/file/x.png")).toBe(
      "/api/media/file/x.png",
    );
  });

  it("never double-prefixes an already-prefixed URL", async () => {
    // The bug that broke admin login (ef405b3) was a prefix applied twice.
    const { resolveMediaUrl } = await loadWithBasePath("/kuara");
    const once = resolveMediaUrl("/api/media/file/x.png");
    expect(resolveMediaUrl(once)).toBe(once);
  });
});
