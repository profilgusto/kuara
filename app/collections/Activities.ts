import { ValidationError } from "payload";
import type { CollectionBeforeValidateHook, CollectionConfig } from "payload";

const relationId = (value: unknown): unknown =>
  typeof value === "object" && value !== null
    ? (value as { id?: unknown }).id
    : value;

/**
 * Stores the code trimmed and in upper case, and keeps it unique within the
 * offer. The site's table checks this too, but only against the rows it has
 * on screen; this is the rule that holds for every way in.
 */
const normalizeAndRejectDuplicateCode: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data;
  if (typeof data.acronym === "string") {
    data.acronym = data.acronym.replace(/\s+/g, "").toLocaleUpperCase("pt-BR");
  }
  if (typeof data.description === "string") {
    data.description = data.description.trim().replace(/\s+/g, " ");
  }

  const acronym = data.acronym ?? originalDoc?.acronym;
  const offer = relationId(data.offer ?? originalDoc?.offer);
  if (!acronym || offer === undefined || offer === null) return data;

  const clash = await req.payload.find({
    collection: "activities",
    where: {
      and: [
        { offer: { equals: offer } },
        { acronym: { equals: acronym } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    depth: 0,
    limit: 1,
    req,
  });
  if (clash.totalDocs > 0) {
    throw new ValidationError({
      collection: "activities",
      errors: [
        {
          path: "acronym",
          message: `This offer already has an activity with the code ${acronym}.`,
        },
      ],
    });
  }
  return data;
};

export const Activities: CollectionConfig = {
  slug: "activities",
  admin: {
    useAsTitle: "acronym",
    defaultColumns: ["acronym", "description", "weight", "type", "offer"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === "admin" || user.role === "professor") return true;
      // Students can read activities of offers they are enrolled in
      return true;
    },
    create: async ({ req, data }) => {
      const user = req.user;
      if (!user) return false;
      if (user.role === "admin") return true;
      if (user.role !== "professor") return false;
      if (!data?.offer) return false;
      try {
        const offer = await req.payload.findByID({
          collection: "offers",
          id: String(data.offer),
          depth: 0,
          overrideAccess: true,
        });
        const instructorId =
          typeof offer.instructor === "object" && offer.instructor !== null
            ? (offer.instructor as { id: string | number }).id
            : offer.instructor;
        return String(instructorId) === String(user.id);
      } catch {
        return false;
      }
    },
    update: async ({ req, id }) => {
      const user = req.user;
      if (!user) return false;
      if (user.role === "admin") return true;
      if (user.role !== "professor") return false;
      if (!id) return false;
      try {
        const activity = await req.payload.findByID({
          collection: "activities",
          id: String(id),
          depth: 0,
          overrideAccess: true,
        });
        const offer = await req.payload.findByID({
          collection: "offers",
          id: String(activity.offer),
          depth: 0,
          overrideAccess: true,
        });
        const instructorId =
          typeof offer.instructor === "object" && offer.instructor !== null
            ? (offer.instructor as { id: string | number }).id
            : offer.instructor;
        return String(instructorId) === String(user.id);
      } catch {
        return false;
      }
    },
    delete: async ({ req, id }) => {
      const user = req.user;
      if (!user) return false;
      if (user.role === "admin") return true;
      if (user.role !== "professor") return false;
      if (!id) return false;
      try {
        const activity = await req.payload.findByID({
          collection: "activities",
          id: String(id),
          depth: 0,
          overrideAccess: true,
        });
        const offer = await req.payload.findByID({
          collection: "offers",
          id: String(activity.offer),
          depth: 0,
          overrideAccess: true,
        });
        const instructorId =
          typeof offer.instructor === "object" && offer.instructor !== null
            ? (offer.instructor as { id: string | number }).id
            : offer.instructor;
        return String(instructorId) === String(user.id);
      } catch {
        return false;
      }
    },
  },
  hooks: {
    beforeValidate: [normalizeAndRejectDuplicateCode],
  },
  fields: [
    {
      name: "offer",
      type: "relationship",
      relationTo: "offers",
      required: true,
      admin: {
        description: "The offer this activity belongs to",
      },
    },
    {
      name: "acronym",
      type: "text",
      required: true,
      admin: {
        description: "Short identifier (e.g., AV, TF, P1)",
      },
    },
    {
      name: "description",
      type: "text",
      required: true,
      admin: {
        description: "Full description (e.g., Avaliação Final, Trabalho Final)",
      },
    },
    {
      name: "weight",
      type: "number",
      required: true,
      min: 0,
      max: 10,
      admin: {
        description:
          "Points this activity is worth. The regular activities of an offer should sum to 10.0; extra ones come on top.",
        step: 0.1,
      },
    },
    {
      name: "mode",
      type: "select",
      required: true,
      defaultValue: "graded",
      options: [
        { label: "Graded", value: "graded" },
        { label: "Checklist", value: "checklist" },
      ],
      admin: {
        description:
          "Graded: each student gets a percentage of the points. Checklist: the points are split across the tasks below, and a student earns the share of the tasks marked as done.",
      },
    },
    {
      name: "tasks",
      type: "array",
      admin: {
        description:
          "The tasks of a checklist activity. Each can be marked done per student.",
        condition: (data) => data?.mode === "checklist",
      },
      fields: [
        {
          name: "code",
          type: "text",
          admin: {
            description: "Short acronym for the table heading (optional).",
          },
        },
        {
          name: "name",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "dueDate",
      type: "date",
      admin: {
        description: "Day the work is due (optional).",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "comment",
      type: "textarea",
      maxLength: 500,
      admin: {
        description: "Notes about this activity (optional).",
      },
    },
    {
      name: "category",
      type: "select",
      required: true,
      defaultValue: "regular",
      options: [
        { label: "Regular", value: "regular" },
        { label: "Extra", value: "extra" },
      ],
      admin: {
        description:
          "Regular activities add up to the semester's 10.0 points; extra ones are bonus points.",
      },
    },
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "individual",
      options: [
        { label: "Individual", value: "individual" },
        { label: "Group", value: "group" },
      ],
      admin: {
        description: "Whether this activity is graded per-student or per-group",
      },
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      admin: {
        description: "Display order within the offer",
      },
    },
  ],
};
