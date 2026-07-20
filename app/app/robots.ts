import type { MetadataRoute } from "next";
import { comBasePath } from "@/lib/base-path";

// Reads NEXT_PUBLIC_SERVER_URL at request time — must not be pre-rendered at build.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "";
  return {
    rules: [
      {
        userAgent: "*",
        // Keep private/admin/API routes out of search indexes. Prefixed with
        // the basePath — these are matched against the real request path
        // (/kuara/payload, not /payload), same class of bug as the icon.svg fix.
        disallow: [
          comBasePath("/payload"),
          comBasePath("/api/"),
          comBasePath("/login"),
          comBasePath("/aluno"),
          comBasePath("/gestao"),
        ],
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
