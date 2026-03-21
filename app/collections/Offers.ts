import type { CollectionConfig } from "payload";

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
