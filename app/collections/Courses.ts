import type { CollectionAfterChangeHook, CollectionConfig } from "payload";
import { ensureOffersForPeriod } from "../lib/ensure-offers.ts";

/**
 * A new course gets the offer of the active general offer only, not the
 * history of past ones: it starts with no past and gains offers as periods
 * go by. With no active offer, it gets none yet — activating one in
 * "Configurações gerais" gives every course its offer (see SiteSettings).
 */
const createActiveOffer: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== "create") return doc;
  const settings = await req.payload.findGlobal({
    slug: "site-settings",
    depth: 1,
    req,
  });
  const active = settings.activeTerm;
  if (typeof active === "object" && active !== null) {
    await ensureOffersForPeriod(req, active.period, [doc.id]);
  }
  return doc;
};

export const Courses: CollectionConfig = {
  slug: "courses",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "code", "instructor", "visibility"],
    components: {
      views: {
        edit: {
          reorderModules: {
            Component: "@/admin/views/ModuleReorderView",
            path: "/reorder-modules",
            tab: {
              label: "Ordenar Módulos",
              href: "/reorder-modules",
            },
          },
        },
      },
    },
  },
  hooks: {
    afterChange: [createActiveOffer],
  },
  access: {
    // Public read - anyone can see courses
    read: () => true,
    // Only admin/professor can create, update, delete
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "code",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "Course code (e.g., PROJ-ROB)",
      },
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "URL-friendly identifier (e.g., projetos-roboticos)",
      },
    },
    {
      name: "summary",
      type: "textarea",
      admin: {
        description: "Brief course description",
      },
    },
    {
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Background image for the discipline card on /disciplinas",
      },
    },
    {
      name: "workload",
      type: "group",
      fields: [
        {
          name: "theoretical",
          type: "number",
          min: 0,
          admin: { description: "Theoretical hours" },
        },
        {
          name: "practical",
          type: "number",
          min: 0,
          admin: { description: "Practical hours" },
        },
      ],
    },
    {
      name: "instructor",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "Default instructor for this course",
      },
    },
    {
      name: "visibility",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "When unchecked, this course is hidden from /disciplinas and all its links return 404.",
      },
    },
  ],
};
