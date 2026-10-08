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
import {
  normalizeRegistration,
  validateEnrollmentImport,
} from "../lib/enrollment.ts";

const isAdmin = ({ req: { user } }: { req: { user?: unknown } }) =>
  (user as { role?: string } | null | undefined)?.role === "admin";

const relationId = (value: unknown): unknown =>
  typeof value === "object" && value !== null
    ? (value as { id?: unknown }).id
    : value;

/**
 * Stores the matrícula in its canonical form and keeps it unique within the
 * offer. The site's modal checks both, but this is the rule that holds for
 * every way in (admin panel, REST, two tabs at once).
 */
const normalizeAndRejectDuplicate: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data;

  if (data.registration !== undefined) {
    const registration = normalizeRegistration(data.registration);
    if (!registration) {
      throw new ValidationError({
        collection: "enrollments",
        errors: [
          {
            path: "registration",
            message: "The registration must be 4 to 20 digits.",
          },
        ],
      });
    }
    data.registration = registration;
  }
  if (typeof data.name === "string") {
    data.name = data.name.trim().replace(/\s+/g, " ");
  }

  const registration = data.registration ?? originalDoc?.registration;
  const offer = relationId(data.offer ?? originalDoc?.offer);
  if (!registration || offer === undefined || offer === null) return data;

  const clash = await req.payload.find({
    collection: "enrollments",
    where: {
      and: [
        { offer: { equals: offer } },
        { registration: { equals: registration } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    depth: 0,
    limit: 1,
    req,
  });
  if (clash.totalDocs > 0) {
    throw new ValidationError({
      collection: "enrollments",
      errors: [
        {
          path: "registration",
          message: `Registration ${registration} is already enrolled in this offer.`,
        },
      ],
    });
  }
  return data;
};

/**
 * POST /api/enrollments/import — enrols a list of students in an offer.
 *
 * Body: `{ offer, classGroup: "A" | "B" | null, students: [{ registration,
 * name }] }` — what the site's modal extracts from a SIGAA spreadsheet. A
 * student already in the offer is updated (name, class group) rather than
 * duplicated, so uploading the same sheet twice changes nothing. All or
 * nothing: one failure rolls the whole list back.
 */
const importEnrollments: PayloadHandler = async (req) => {
  if (req.user?.role !== "admin") {
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json?.();
  } catch {
    // Malformed JSON falls through to the validator as `null`.
  }
  const parsed = validateEnrollmentImport(body);
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
    const existing = await req.payload.find({
      collection: "enrollments",
      where: { offer: { equals: offer.id } },
      depth: 0,
      pagination: false,
      req,
    });
    const byRegistration = new Map(
      existing.docs.map((doc) => [doc.registration, doc]),
    );

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const student of parsed.students) {
      const current = byRegistration.get(student.registration);
      if (!current) {
        await req.payload.create({
          collection: "enrollments",
          data: { ...student, offer: offer.id, classGroup: parsed.classGroup },
          req,
        });
        created += 1;
      } else if (
        current.name !== student.name ||
        (current.classGroup ?? null) !== parsed.classGroup
      ) {
        await req.payload.update({
          collection: "enrollments",
          id: current.id,
          data: { name: student.name, classGroup: parsed.classGroup },
          req,
        });
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    if (shouldCommit) await commitTransaction(req);
    return Response.json({ created, updated, unchanged });
  } catch (error) {
    await killTransaction(req);
    req.payload.logger.error({ err: error, msg: "Enrollment import failed" });
    return Response.json(
      { error: "Não foi possível cadastrar os discentes." },
      { status: 500 },
    );
  }
};

/**
 * A student enrolled in an offer, known by matrícula and name.
 *
 * Deliberately not a `users` relationship: a class list comes from SIGAA with
 * no e-mail addresses, so these students have no account to point at.
 * Admin-only throughout — it is a list of people's names.
 */
export const Enrollments: CollectionConfig = {
  slug: "enrollments",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["registration", "name", "classGroup", "offer"],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  endpoints: [{ path: "/import", method: "post", handler: importEnrollments }],
  hooks: {
    beforeValidate: [normalizeAndRejectDuplicate],
  },
  fields: [
    {
      name: "offer",
      type: "relationship",
      relationTo: "offers",
      required: true,
      index: true,
    },
    {
      name: "registration",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Matrícula: digits only, unique within the offer.",
      },
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "classGroup",
      type: "select",
      options: [
        { label: "A", value: "A" },
        { label: "B", value: "B" },
      ],
      admin: {
        description:
          "For a class split in two. Leave empty when the class is not split.",
      },
    },
    {
      name: "group",
      type: "relationship",
      relationTo: "student-groups",
      index: true,
      admin: {
        description:
          "The work group this student belongs to for the semester, if any. Pick a group of the same offer.",
      },
    },
  ],
};
