import type { MetadataRoute } from "next";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "";

  const payload = await getPayload({ config: configPromise });

  const courses = await payload.find({
    collection: "courses",
    limit: 1000,
    depth: 0,
    where: { _status: { equals: "published" } },
  });

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/disciplinas`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  for (const course of courses.docs) {
    entries.push({
      url: `${baseUrl}/disciplinas/${course.slug}`,
      lastModified: new Date(course.updatedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}
