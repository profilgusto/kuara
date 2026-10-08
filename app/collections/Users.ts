import { APIError } from "payload";
import type { CollectionConfig, PayloadHandler } from "payload";
import {
  passwordEmailHtml,
  passwordEmailSubject,
} from "../lib/account-emails.ts";
import { createRateLimiter } from "../lib/account-request.ts";
import { validatePasswordChange } from "../lib/profile.ts";

// Ten tries per 15 minutes per account: room for typos, not for guessing the
// current password from a session left open.
const passwordChangeLimiter = createRateLimiter(10, 15 * 60 * 1000);

/**
 * POST /api/users/change-password — used by /minha-area.
 *
 * Payload's own update would accept a new password from the session alone.
 * This asks for the current one too, so a browser left signed in is not
 * enough to take the account over.
 */
const changePassword: PayloadHandler = async (req) => {
  const user = req.user;
  if (!user || user.collection !== "users") {
    return Response.json({ error: "Você não está logado." }, { status: 401 });
  }
  if (!passwordChangeLimiter.allow(String(user.id))) {
    return Response.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  let body: unknown = null;
  try {
    body = await req.json?.();
  } catch {
    // Malformed JSON falls through to the validator as `null`.
  }

  const parsed = validatePasswordChange(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await req.payload.login({
      collection: "users",
      data: { email: user.email, password: parsed.data.currentPassword },
      depth: 0,
    });
  } catch {
    return Response.json(
      { error: "A senha atual está incorreta." },
      { status: 403 },
    );
  }

  await req.payload.update({
    collection: "users",
    id: user.id,
    data: { password: parsed.data.newPassword },
    depth: 0,
  });

  return Response.json({ ok: true });
};

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
    // Payload's default e-mail links to its own admin reset screen. Ours point
    // at /redefinir-senha, the site's page, which every role can use.
    // No `expiration` here on purpose: a value set in config overrides the
    // per-call one, and account approval needs a longer-lived link than a
    // password recovery does (see collections/AccountRequests.ts).
    forgotPassword: {
      generateEmailSubject: (args) =>
        passwordEmailSubject(args?.req?.context?.accountApproved === true),
      generateEmailHTML: (args) =>
        passwordEmailHtml({
          name: args?.user?.name,
          token: args?.token ?? "",
          serverUrl: process.env.NEXT_PUBLIC_SERVER_URL || "",
          welcome: args?.req?.context?.accountApproved === true,
        }),
    },
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
  hooks: {
    beforeValidate: [
      // A session alone must not be able to set a new password through the
      // generic PATCH /api/users/:id: /change-password asks for the current
      // one. That endpoint calls the local API without a request, so no user
      // is attached there; admins may still set passwords from the panel.
      ({ data, operation, req }) => {
        if (
          operation === "update" &&
          data?.password &&
          req.user &&
          req.user.role !== "admin"
        ) {
          throw new APIError(
            "Use a rota de troca de senha para alterar a senha.",
            403,
          );
        }
        return data;
      },
    ],
  },
  endpoints: [
    { path: "/change-password", method: "post", handler: changePassword },
  ],
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
      // Copied into the session token so a middleware can route by role
      // without a database call (see lib/payload-jwt.ts). Payload only puts id and email there unless
      // a field asks for it.
      saveToJWT: true,
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
