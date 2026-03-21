import type { CollectionConfig } from "payload";

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
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
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
          "Weight of this activity (all weights in an offer must sum to 10.0)",
        step: 0.1,
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
