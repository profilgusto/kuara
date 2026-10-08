import crypto from "crypto";
import type {
  CollectionAfterChangeHook,
  CollectionConfig,
  PayloadHandler,
} from "payload";
import {
  clientIp,
  createRateLimiter,
  validateAccountRequest,
} from "../lib/account-request.ts";
import { WELCOME_LINK_EXPIRATION_MS } from "../lib/account-emails.ts";

// Five requests per hour from one address: plenty for a person, too few for
// a script filling the admin's queue.
const limiter = createRateLimiter(5, 60 * 60 * 1000);

/**
 * POST /api/account-requests/request — the only way in for visitors.
 *
 * The collection itself is admin-only; this endpoint accepts the four public
 * fields, forces `status: pending`, and answers the same way whether or not
 * the e-mail is already known, so it cannot be used to probe for accounts.
 */
const requestAccount: PayloadHandler = async (req) => {
  const ip = clientIp(req.headers.get("x-forwarded-for"));
  if (!limiter.allow(ip)) {
    return Response.json(
      { error: "Muitas solicitações. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  let body: unknown = null;
  try {
    body = await req.json?.();
  } catch {
    // Malformed JSON falls through to the validator as `null`.
  }

  const parsed = validateAccountRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { email } = parsed.data;
  const [users, pending] = await Promise.all([
    req.payload.find({
      collection: "users",
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
    }),
    req.payload.find({
      collection: "account-requests",
      where: {
        and: [{ email: { equals: email } }, { status: { equals: "pending" } }],
      },
      limit: 1,
      depth: 0,
    }),
  ]);

  if (users.totalDocs === 0 && pending.totalDocs === 0) {
    await req.payload.create({
      collection: "account-requests",
      data: { ...parsed.data, status: "pending" },
    });
  }

  return Response.json({ ok: true });
};

/**
 * Approving a request creates the user and e-mails a link to set a password.
 *
 * The account gets a random password nobody knows: the requester never typed
 * one, and the reset link is what proves they own the address.
 *
 * The user is created and the link sent OUTSIDE the approval's transaction
 * (no `req`). Payload 3.90 reserves its per-user "forgot password" throttle on
 * a separate database connection, which cannot see a row that is still
 * uncommitted: inside the transaction it finds no user and silently sends
 * nothing. To keep the old guarantee — a failed e-mail must leave the request
 * pending, not an account its owner cannot reach — a failure here deletes the
 * user again and rethrows, which rolls the approval back.
 */
const createUserOnApproval: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update") return doc;
  if (doc.status !== "approved" || previousDoc?.status === "approved") {
    return doc;
  }

  const existing = await req.payload.find({
    collection: "users",
    where: { email: { equals: doc.email } },
    limit: 1,
    depth: 0,
  });
  if (existing.totalDocs > 0) return doc;

  const user = await req.payload.create({
    collection: "users",
    data: {
      name: doc.name,
      email: doc.email,
      role: doc.requestedRole,
      password: crypto.randomBytes(24).toString("hex"),
    },
  });

  try {
    await req.payload.forgotPassword({
      collection: "users",
      data: { email: doc.email },
      expiration: WELCOME_LINK_EXPIRATION_MS,
      // Read by the e-mail generators in collections/Users.ts.
      context: { accountApproved: true },
    });
  } catch (error) {
    await req.payload.delete({ collection: "users", id: user.id });
    throw error;
  }

  return doc;
};

export const AccountRequests: CollectionConfig = {
  slug: "account-requests",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "email", "requestedRole", "status", "createdAt"],
    description:
      "Requests sent from the site's user menu. Setting a request to Approved creates the user and e-mails them a link to set a password.",
  },
  access: {
    read: ({ req: { user } }) => user?.role === "admin",
    // Visitors go through the /request endpoint below, never through here.
    create: ({ req: { user } }) => user?.role === "admin",
    update: ({ req: { user } }) => user?.role === "admin",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  endpoints: [{ path: "/request", method: "post", handler: requestAccount }],
  hooks: {
    afterChange: [createUserOnApproval],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "email",
      type: "email",
      required: true,
    },
    {
      name: "requestedRole",
      type: "select",
      required: true,
      defaultValue: "student",
      options: [
        { label: "Student", value: "student" },
        { label: "Professor", value: "professor" },
      ],
      admin: {
        description:
          "Role the account is created with on approval. Change it before approving if needed.",
      },
    },
    {
      name: "message",
      type: "textarea",
      admin: {
        description: "What the requester wrote (course, class, reason).",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ],
    },
  ],
};
