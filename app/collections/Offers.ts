import { ValidationError } from "payload";
import type { CollectionBeforeValidateHook, CollectionConfig } from "payload";

const relationId = (value: unknown): unknown =>
  typeof value === "object" && value !== null
    ? (value as { id?: unknown }).id
    : value;

/**
 * A course has at most one offer per period. The site's "create offer" dialog
 * checks this too, but only against the list it has on screen; this is the
 * rule that holds for every way in (admin panel, REST, two tabs at once).
 */
const rejectDuplicatePeriod: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const period = (data?.period ?? originalDoc?.period)?.trim?.();
  const course = relationId(data?.course ?? originalDoc?.course);
  if (!period || course === undefined || course === null) return data;

  const clash = await req.payload.find({
    collection: "offers",
    where: {
      and: [
        { course: { equals: course } },
        { period: { equals: period } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    depth: 0,
    limit: 1,
    req,
  });
  if (clash.totalDocs > 0) {
    throw new ValidationError({
      collection: "offers",
      errors: [
        {
          path: "period",
          message: `This course already has an offer for ${period}.`,
        },
      ],
    });
  }
  return data;
};

export const Offers: CollectionConfig = {
  slug: "offers",
  admin: {
    useAsTitle: "period",
    defaultColumns: ["period", "course", "status", "instructor"],
  },
  access: {
    // Public read - students can see available offers
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    beforeValidate: [rejectDuplicatePeriod],
  },
  fields: [
    {
      name: "period",
      type: "text",
      required: true,
      admin: {
        description: "Semester period (e.g., 2026.1, 2026.2)",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
    },
    {
      name: "course",
      type: "relationship",
      relationTo: "courses",
      required: true,
      admin: {
        description: "Which course this offer belongs to",
      },
    },
    {
      name: "instructor",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "Instructor for this specific offering",
      },
    },
    {
      name: "students",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      admin: {
        description: "Students enrolled in this offer",
      },
    },
    {
      name: "currentModule",
      type: "relationship",
      relationTo: "modules",
      admin: {
        description:
          "The module the class is currently on. Controls synchronous progression for students.",
      },
    },
    {
      name: "logs",
      type: "array",
      admin: {
        description: "Audit log tracking grading/activity changes",
      },
      fields: [
        {
          name: "timestamp",
          type: "date",
          required: true,
        },
        {
          name: "action",
          type: "text",
          required: true,
        },
        {
          name: "details",
          type: "textarea",
        },
        {
          name: "performedBy",
          type: "relationship",
          relationTo: "users",
        },
      ],
    },
  ],
};
