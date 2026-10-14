import type { GlobalAfterChangeHook, GlobalConfig } from "payload";
import { allCourseIds, ensureOffersForPeriod } from "../lib/ensure-offers.ts";

/**
 * Whichever general offer becomes active, every course has its offer for it:
 * courses created while another one (or none) was active have no past, and
 * would otherwise show nothing.
 */
const ensureActiveOffers: GlobalAfterChangeHook = async ({ doc, req }) => {
  const active = doc.activeTerm;
  if (active === null || active === undefined) return doc;
  const term =
    typeof active === "object"
      ? active
      : await req.payload.findByID({
          collection: "terms",
          id: active,
          depth: 0,
          req,
        });
  await ensureOffersForPeriod(req, term.period, await allCourseIds(req));
  return doc;
};

/**
 * Platform-wide options, edited in "Configurações gerais". For now: which
 * general offer is the current one. The course pages show the offer block
 * for that period, or none when this is empty.
 */
export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  access: {
    // Public read: the course pages need the active period.
    read: () => true,
    update: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    afterChange: [ensureActiveOffers],
  },
  fields: [
    {
      name: "activeTerm",
      type: "relationship",
      relationTo: "terms",
      admin: {
        description:
          "The offer the course pages show. Empty: no offer is shown.",
      },
    },
  ],
};
