import { ValidationError } from "payload";
import type {
  CollectionAfterChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload";
import { allCourseIds, ensureOffersForPeriod } from "../lib/ensure-offers.ts";
import { parsePeriod } from "../lib/offer-period.ts";

const isAdmin = ({ req: { user } }: { req: { user?: unknown } }) =>
  (user as { role?: string } | null | undefined)?.role === "admin";

/** Tidies the period and holds it to YEAR.SEMESTER, semester 1 or 2. */
const normalizePeriod: CollectionBeforeValidateHook = ({ data }) => {
  if (!data || typeof data.period !== "string") return data;
  data.period = data.period.trim();
  const parsed = parsePeriod(data.period);
  if (!parsed || (parsed.semester !== 1 && parsed.semester !== 2)) {
    throw new ValidationError({
      collection: "terms",
      errors: [
        {
          path: "period",
          message: "The period must look like 2026.1 or 2026.2.",
        },
      ],
    });
  }
  return data;
};

/**
 * A new general offer gives every course its own offer for that period, so
 * the course's offers page has something to enrol students and register
 * assessments in.
 */
const createCourseOffers: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation === "create") {
    await ensureOffersForPeriod(req, doc.period, await allCourseIds(req));
  }
  return doc;
};

/**
 * A general offer: a semester of the whole platform ("2026.2"), created in
 * "Configurações gerais". Which one is current is the `site-settings` global.
 */
export const Terms: CollectionConfig = {
  slug: "terms",
  admin: {
    useAsTitle: "period",
    defaultColumns: ["period", "createdAt"],
  },
  access: {
    // Public read: the course pages look up the active period.
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [normalizePeriod],
    afterChange: [createCourseOffers],
  },
  fields: [
    {
      name: "period",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Semester period (e.g., 2026.1, 2026.2)" },
    },
  ],
};
