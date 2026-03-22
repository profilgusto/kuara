import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "";
  return {
    rules: [
      {
        userAgent: "*",
        // Keep private/admin/API routes out of search indexes
        disallow: ["/admin", "/api/", "/login", "/aluno", "/gestao"],
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
