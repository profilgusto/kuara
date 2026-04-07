import type { CollectionBeforeChangeHook } from "payload";
import { extractCiteTesselaSlugs } from "../lib/tessela-links";
import { extractCiteModuleSlugs } from "../lib/module-links";

/**
 * Before a Module is saved, scan its MDX content for:
 *   - <CiteTessela slug="..."> → sets relatedTesselas
 *   - <CiteModule slug="...">  → sets relatedModules (excluding self)
 *
 * Using beforeChange means the IDs are written in the same DB operation —
 * no nested payload.update(), no double-save.
 *
 * IDs are kept as their native type (number for PostgreSQL serial).
 */
export const syncModuleCrossRefs: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  // If content is not being changed in this operation, leave relations alone.
  if (data.content === undefined) return data;

  const content = (data.content as string) ?? "";
  const docSlug =
    (data.slug as string | undefined) ??
    (originalDoc?.slug as string | undefined);

  // ── relatedTesselas ────────────────────────────────────────────────────────
  const tesselaSlugs = extractCiteTesselaSlugs(content);

  // ── relatedModules ─────────────────────────────────────────────────────────
  const moduleSlugs = extractCiteModuleSlugs(content).filter(
    (s) => s !== docSlug,
  );

  try {
    const [tesselaResults, moduleResults] = await Promise.all([
      Promise.all(
        tesselaSlugs.map((slug) =>
          req.payload.find({
            collection: "tesselas",
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          }),
        ),
      ),
      Promise.all(
        moduleSlugs.map((slug) =>
          req.payload.find({
            collection: "modules",
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          }),
        ),
      ),
    ]);

    const tesselaIds = tesselaResults
      .filter((r) => r.docs[0])
      .map((r) => r.docs[0].id);

    const moduleIds = moduleResults
      .filter((r) => r.docs[0])
      .map((r) => r.docs[0].id);

    return {
      ...data,
      relatedTesselas: tesselaIds,
      relatedModules: moduleIds,
    };
  } catch (err) {
    req.payload.logger.error({ err }, "[syncModuleCrossRefs] sync failed");
    return data;
  }
};
