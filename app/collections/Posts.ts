import type { CollectionConfig } from "payload";
import { syncPostMediaRefs, cleanPostMediaRefs } from "../hooks/syncMediaUsedIn.ts";

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "publishedAt", "offer"],
  },
  access: {
    // General posts are public; offer-scoped posts only visible to enrolled students
    read: ({ req: { user } }) => {
      // Public posts (no offer) are always readable
      // For offer-scoped posts, we allow read and filter in the frontend
      return true;
    },
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    afterChange: [syncPostMediaRefs],
    afterDelete: [cleanPostMediaRefs],
  },
  fields: [
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
    },
    {
      name: "body",
      type: "richText",
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        description: "Publication date",
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "offer",
      type: "relationship",
      relationTo: "offers",
      admin: {
        description:
          "Optional: link to a specific offer for offer-scoped announcements. Leave empty for general news.",
      },
    },
  ],
};
