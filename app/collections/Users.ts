import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  // Payload's default token lifetime is 7200s (2h), which forced a new login
  // several times a day. 30 days keeps a browser signed in for at least a
  // month: the JWT's `exp` and the `payload-token` cookie's Max-Age are both
  // derived from this value. The admin panel silently refreshes the token
  // while a tab is open, so an active user effectively never gets kicked out.
  // This is a config-level setting — it applies to every browser, there is no
  // per-device "remember me" in Payload.
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // 30 days, in seconds
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "email", "role"],
  },
  access: {
    // Admin can read all; students can only read themselves
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === "admin" || user.role === "professor") return true;
      return { id: { equals: user.id } };
    },
    // Only admin can create users
    create: ({ req: { user } }) => user?.role === "admin",
    // Admin can update all; users can update themselves
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return { id: { equals: user.id } };
    },
    // Only admin can delete
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "student",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Professor", value: "professor" },
        { label: "Student", value: "student" },
      ],
      access: {
        // Only admin can change roles
        update: ({ req: { user } }) => user?.role === "admin",
      },
    },
  ],
};
