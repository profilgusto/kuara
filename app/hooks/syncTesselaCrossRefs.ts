import type { CollectionBeforeChangeHook } from "payload";
import { extractCiteTesselaSlugs } from "../lib/tessela-links";

/**
 * Before a Tessela is saved, scan its MDX content for <CiteTessela slug="...">
 * components and set the relatedTesselas relationship field to match exactly
 * the set of tesselas cited in the content.
 *
 * Using beforeChange (not afterChange) means the IDs are written in the SAME
 * database operation — no nested payload.update() call, no double-save, no
 * 9-second delay.
 *
 * IDs are kept as their native type (number for PostgreSQL serial).
 * Payload's relationship validator uses isValidID(value, 'number') which
 * requires typeof value === 'number' — string IDs like "1" would fail.
 */
export const syncTesselaCrossRefs: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  // If content is not being changed in this operation, leave relatedTesselas alone.
  if (data.content === undefined) return data;

  const content = (data.content as string) ?? "";
  const docSlug =
    (data.slug as string | undefined) ??
    (originalDoc?.slug as string | undefined);

  const slugs = extractCiteTesselaSlugs(content);

  if (slugs.length === 0) {
    return { ...data, relatedTesselas: [] };
  }

  try {
    // Resolve all slugs → IDs in parallel (skip self-references)
    const filtered = slugs.filter((s) => s !== docSlug);
    const results = await Promise.all(
      filtered.map((slug) =>
        req.payload.find({
          collection: "tesselas",
          where: { slug: { equals: slug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
      ),
    );

    // Keep IDs as their native type (number for PostgreSQL).
    // Payload's isValidID(value, 'number') rejects string IDs.
    const ids = results
      .filter((r) => r.docs[0])
      .map((r) => r.docs[0].id);

    return { ...data, relatedTesselas: ids };
  } catch (err) {
    req.payload.logger.error({ err }, "[syncTesselaCrossRefs] sync failed");
    return data;
  }
};
