import type { CollectionConfig } from "payload";

export const Scores: CollectionConfig = {
  slug: "scores",
  admin: {
    defaultColumns: [
      "activity",
      "entityType",
      "student",
      "group",
      "percentage",
    ],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === "admin" || user.role === "professor") return true;
      // Students can only see their own scores
      return {
        or: [
          { student: { equals: user.id } },
          // Also allow if the student is in the scored group
        ],
      };
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
        const score = await req.payload.findByID({
          collection: "scores",
          id: String(id),
          depth: 0,
          overrideAccess: true,
        });
        const offer = await req.payload.findByID({
          collection: "offers",
          id: String(score.offer),
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
        const score = await req.payload.findByID({
          collection: "scores",
          id: String(id),
          depth: 0,
          overrideAccess: true,
        });
        const offer = await req.payload.findByID({
          collection: "offers",
          id: String(score.offer),
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
    },
    {
      name: "activity",
      type: "relationship",
      relationTo: "activities",
      required: true,
    },
    {
      name: "entityType",
      type: "select",
      required: true,
      options: [
        { label: "Student", value: "student" },
        { label: "Group", value: "group" },
      ],
      admin: {
        description:
          "Whether this score is for an individual student or a group",
      },
    },
    {
      name: "student",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "The student (if entityType is student)",
        condition: (data) => data?.entityType === "student",
      },
    },
    {
      name: "group",
      type: "relationship",
      relationTo: "student-groups",
      admin: {
        description: "The group (if entityType is group)",
        condition: (data) => data?.entityType === "group",
      },
    },
    {
      name: "percentage",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      admin: {
        description: "Score from 0% to 100%",
        step: 0.1,
      },
    },
  ],
};
