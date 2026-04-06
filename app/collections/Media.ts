import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  folders: true,
  upload: {
    mimeTypes: [
      "image/*",
      "application/pdf",
      "video/*",
      "audio/*",
      "application/zip",
      "application/x-zip-compressed",
    ],
  },
  admin: {
    useAsTitle: "alt",
    defaultColumns: ["alt", "filename", "mimeType", "filesize"],
    listSearchableFields: ["alt", "filename"],
    components: {
      beforeListTable: ["@/admin/components/BackfillUsedInButton"],
    },
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
  },
  fields: [
    {
      name: "alt",
      type: "text",
      admin: {
        description: "Alternative text for accessibility",
      },
    },
    {
      name: "usedIn",
      type: "relationship",
      relationTo: ["modules", "posts", "tesselas"] as const,
      hasMany: true,
      admin: {
        readOnly: true,
        position: "sidebar",
        description: "Auto-detected: content that references this file",
      },
    },
  ],
};
