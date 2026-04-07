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
