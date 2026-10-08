import crypto from "crypto";
import {
  ValidationError,
  commitTransaction,
  initTransaction,
  killTransaction,
} from "payload";
import type {
  CollectionBeforeValidateHook,
  CollectionConfig,
  PayloadHandler,
} from "payload";
import { planGroupDraw, validateDrawRequest } from "../lib/group-draw.ts";
import { parseClassGroup } from "../lib/enrollment.ts";

const relationId = (value: unknown): unknown =>
  typeof value === "object" && value !== null
    ? (value as { id?: unknown }).id
    : value;

/**
 * Tidies the name and keeps it unique within the offer, whatever its case.
 * The site's modal checks this too, but only against the groups it has on
 * screen; this is the rule that holds for every way in.
 */
const normalizeAndRejectDuplicateName: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data;
  if (typeof data.name === "string") {
    data.name = data.name.trim().replace(/\s+/g, " ");
  }

  const name = data.name ?? originalDoc?.name;
  const offer = relationId(data.offer ?? originalDoc?.offer);
  if (!name || offer === undefined || offer === null) return data;

  const siblings = await req.payload.find({
    collection: "student-groups",
    where: {
      and: [
        { offer: { equals: offer } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    depth: 0,
    pagination: false,
    req,
  });
  const key = String(name).toLocaleLowerCase("pt-BR");
  if (
    siblings.docs.some((doc) => doc.name.toLocaleLowerCase("pt-BR") === key)
  ) {
    throw new ValidationError({
      collection: "student-groups",
      errors: [
        {
          path: "name",
          message: `This offer already has a group named ${name}.`,
        },
      ],
    });
  }
  return data;
};

/**
 * POST /api/student-groups/draw — draws an offer's students into new groups.
 *
 * Body: `{ offer, size, scope: "all" | "classGroup" }`. Only the students
 * who are in no group yet take part, so a draw never undoes groups that
 * already exist; the new ones are named "Grupo N", continuing the numbering.
 * With the `classGroup` scope each subturma (A, B) is drawn on its own.
 * All or nothing: one failure rolls the whole draw back.
 */
const drawGroups: PayloadHandler = async (req) => {
  if (req.user?.role !== "admin") {
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json?.();
  } catch {
    // Malformed JSON falls through to the validator as `null`.
  }
  const parsed = validateDrawRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const offers = await req.payload.find({
    collection: "offers",
    where: { id: { equals: parsed.offer } },
    depth: 0,
    limit: 1,
  });
  const offer = offers.docs[0];
  if (!offer) {
    return Response.json({ error: "Oferta não encontrada." }, { status: 404 });
  }

  const shouldCommit = await initTransaction(req);
  try {
    const [ungrouped, existing] = await Promise.all([
      req.payload.find({
        collection: "enrollments",
        where: {
          and: [{ offer: { equals: offer.id } }, { group: { exists: false } }],
        },
        depth: 0,
        pagination: false,
        req,
      }),
      req.payload.find({
        collection: "student-groups",
        where: { offer: { equals: offer.id } },
        depth: 0,
        pagination: false,
        req,
      }),
    ]);

    const plan = planGroupDraw({
      students: ungrouped.docs.map((doc) => ({
        id: doc.id,
        classGroup: parseClassGroup(doc.classGroup),
      })),
      size: parsed.size,
      scope: parsed.scope,
      existingNames: existing.docs.map((doc) => doc.name),
      random: () => crypto.randomInt(0, 2 ** 32) / 2 ** 32,
    });

    for (const planned of plan) {
      const group = await req.payload.create({
        collection: "student-groups",
        data: { name: planned.name, offer: offer.id },
        req,
      });
      const assigned = await req.payload.update({
        collection: "enrollments",
        where: { id: { in: planned.memberIds } },
        data: { group: group.id },
        req,
      });
      // A bulk update reports failures instead of throwing them.
      if (assigned.errors.length > 0) {
        throw new Error(
          `Could not assign ${assigned.errors.length} student(s) to ${planned.name}`,
        );
      }
    }

    if (shouldCommit) await commitTransaction(req);
    return Response.json({
      groups: plan.length,
      students: plan.reduce((sum, g) => sum + g.memberIds.length, 0),
    });
  } catch (error) {
    await killTransaction(req);
    req.payload.logger.error({ err: error, msg: "Group draw failed" });
    return Response.json(
      { error: "Não foi possível sortear os grupos." },
      { status: 500 },
    );
  }
};

export const StudentGroups: CollectionConfig = {
  slug: "student-groups",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "offer"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === "admin" || user.role === "professor") return true;
      // Students can read groups they belong to
      return true;
    },
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
  },
  endpoints: [{ path: "/draw", method: "post", handler: drawGroups }],
  hooks: {
    beforeValidate: [normalizeAndRejectDuplicateName],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      admin: {
        description: "Group name (e.g., Grupo 1, Equipe Alpha)",
      },
    },
    {
      name: "offer",
      type: "relationship",
      relationTo: "offers",
      required: true,
    },
    {
      name: "students",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      admin: {
        description: "Students assigned to this group",
      },
    },
  ],
};
