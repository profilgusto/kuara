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
  toggleTask,
  validateSetScores,
  validateSetTask,
} from "../lib/grades.ts";
import { parseTasks } from "../lib/assessment.ts";

const relationId = (value: unknown): unknown =>
  typeof value === "object" && value !== null
    ? (value as { id?: unknown }).id
    : value;

/**
 * One grade per student per activity. The site only writes grades through
 * the /set endpoint below, which updates in place; this is the rule that
 * holds for every other way in (admin panel, plain REST).
 */
const rejectDuplicateScore: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const activity = relationId(data?.activity ?? originalDoc?.activity);
  const enrollment = relationId(data?.enrollment ?? originalDoc?.enrollment);
  if (!activity || !enrollment) return data;

  const clash = await req.payload.find({
    collection: "scores",
    where: {
      and: [
        { activity: { equals: activity } },
        { enrollment: { equals: enrollment } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    depth: 0,
    limit: 1,
    req,
  });
  if (clash.totalDocs > 0) {
    throw new ValidationError({
      collection: "scores",
      errors: [
        {
          path: "enrollment",
          message: "This student already has a score in this activity.",
        },
      ],
    });
  }
  return data;
};

/**
 * POST /api/scores/set — gives one grade to one or more students.
 *
 * Body: `{ offer, activity, enrollments: id[], percentage: number | null }`.
 * A single cell of the site's table sends one enrollment; the cell on a
 * group's row sends all of that group's members, which is how a group grade
 * becomes each member's own. `null` clears the grade. A student who already
 * has a grade in the activity gets it updated, never duplicated. All or
 * nothing: one failure rolls the whole request back.
 */
const setScores: PayloadHandler = async (req) => {
  if (req.user?.role !== "admin") {
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json?.();
  } catch {
    // Malformed JSON falls through to the validator as `null`.
  }
  const parsed = validateSetScores(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // The activity and every student must belong to the offer named.
  const [activities, enrollments] = await Promise.all([
    req.payload.find({
      collection: "activities",
      where: {
        and: [
          { id: { equals: parsed.activity } },
          { offer: { equals: parsed.offer } },
        ],
      },
      depth: 0,
      limit: 1,
    }),
    req.payload.find({
      collection: "enrollments",
      where: {
        and: [
          { id: { in: parsed.enrollments } },
          { offer: { equals: parsed.offer } },
        ],
      },
      depth: 0,
      pagination: false,
    }),
  ]);
  const activity = activities.docs[0];
  if (!activity) {
    return Response.json(
      { error: "Avaliação não encontrada nesta oferta." },
      { status: 400 },
    );
  }
  if (enrollments.docs.length !== parsed.enrollments.length) {
    return Response.json(
      { error: "Há discentes que não pertencem a esta oferta." },
      { status: 400 },
    );
  }

  const shouldCommit = await initTransaction(req);
  try {
    const existing = await req.payload.find({
      collection: "scores",
      where: {
        and: [
          { activity: { equals: activity.id } },
          { enrollment: { in: enrollments.docs.map((doc) => doc.id) } },
        ],
      },
      depth: 0,
      pagination: false,
      req,
    });
    const byEnrollment = new Map(
      existing.docs.map((doc) => [String(relationId(doc.enrollment)), doc]),
    );

    for (const enrollment of enrollments.docs) {
      const current = byEnrollment.get(String(enrollment.id));
      if (parsed.percentage === null) {
        if (current) {
          await req.payload.delete({
            collection: "scores",
            id: current.id,
            req,
          });
        }
      } else if (current) {
        await req.payload.update({
          collection: "scores",
          id: current.id,
          data: { percentage: parsed.percentage },
          req,
        });
      } else {
        await req.payload.create({
          collection: "scores",
          data: {
            offer: activity.offer,
            activity: activity.id,
            entityType: "student",
            enrollment: enrollment.id,
            percentage: parsed.percentage,
          },
          req,
        });
      }
    }

    if (shouldCommit) await commitTransaction(req);
    return Response.json({ students: enrollments.docs.length });
  } catch (error) {
    await killTransaction(req);
    req.payload.logger.error({ err: error, msg: "Setting scores failed" });
    return Response.json(
      { error: "Não foi possível salvar a nota." },
      { status: 500 },
    );
  }
};

/**
 * POST /api/scores/tasks — marks one task of a checklist activity as done,
 * or not done, for one or more students.
 *
 * Body: `{ offer, activity, task, enrollments: id[], done }`. A checkbox of
 * the site's table sends one enrollment; the one on a group's row sends all
 * of that group's members. Each student's score row keeps the ids of the
 * tasks they have done, and its percentage is their share of the activity's
 * tasks at that moment. All or nothing.
 */
const setTask: PayloadHandler = async (req) => {
  if (req.user?.role !== "admin") {
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json?.();
  } catch {
    // Malformed JSON falls through to the validator as `null`.
  }
  const parsed = validateSetTask(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const [activities, enrollments] = await Promise.all([
    req.payload.find({
      collection: "activities",
      where: {
        and: [
          { id: { equals: parsed.activity } },
          { offer: { equals: parsed.offer } },
        ],
      },
      depth: 0,
      limit: 1,
    }),
    req.payload.find({
      collection: "enrollments",
      where: {
        and: [
          { id: { in: parsed.enrollments } },
          { offer: { equals: parsed.offer } },
        ],
      },
      depth: 0,
      pagination: false,
    }),
  ]);
  const activity = activities.docs[0];
  if (!activity) {
    return Response.json(
      { error: "Avaliação não encontrada nesta oferta." },
      { status: 400 },
    );
  }
  const tasks = parseTasks(activity.tasks);
  if (
    activity.mode !== "checklist" ||
    !tasks.some((t) => t.id === parsed.task)
  ) {
    return Response.json(
      { error: "Tarefa não encontrada nesta avaliação." },
      { status: 400 },
    );
  }
  if (enrollments.docs.length !== parsed.enrollments.length) {
    return Response.json(
      { error: "Há discentes que não pertencem a esta oferta." },
      { status: 400 },
    );
  }

  const shouldCommit = await initTransaction(req);
  try {
    const existing = await req.payload.find({
      collection: "scores",
      where: {
        and: [
          { activity: { equals: activity.id } },
          { enrollment: { in: enrollments.docs.map((doc) => doc.id) } },
        ],
      },
      depth: 0,
      pagination: false,
      req,
    });
    const byEnrollment = new Map(
      existing.docs.map((doc) => [String(relationId(doc.enrollment)), doc]),
    );
    const valid = new Set(tasks.map((t) => t.id));

    for (const enrollment of enrollments.docs) {
      const current = byEnrollment.get(String(enrollment.id));
      const before = Array.isArray(current?.completedTasks)
        ? (current.completedTasks as unknown[]).map(String)
        : [];
      // Tasks deleted since are dropped along the way.
      const completed = toggleTask(before, parsed.task, parsed.done).filter(
        (id) => valid.has(id),
      );
      const percentage = (completed.length / tasks.length) * 100;

      if (current) {
        await req.payload.update({
          collection: "scores",
          id: current.id,
          data: { completedTasks: completed, percentage },
          req,
        });
      } else if (completed.length > 0) {
        await req.payload.create({
          collection: "scores",
          data: {
            offer: activity.offer,
            activity: activity.id,
            entityType: "student",
            enrollment: enrollment.id,
            completedTasks: completed,
            percentage,
          },
          req,
        });
      }
    }

    if (shouldCommit) await commitTransaction(req);
    return Response.json({ students: enrollments.docs.length });
  } catch (error) {
    await killTransaction(req);
    req.payload.logger.error({ err: error, msg: "Marking a task failed" });
    return Response.json(
      { error: "Não foi possível salvar a tarefa." },
      { status: 500 },
    );
  }
};

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
  endpoints: [
    { path: "/set", method: "post", handler: setScores },
    { path: "/tasks", method: "post", handler: setTask },
  ],
  hooks: {
    beforeValidate: [rejectDuplicateScore],
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
      name: "enrollment",
      type: "relationship",
      relationTo: "enrollments",
      index: true,
      admin: {
        description:
          "The enrolled student this score belongs to (if entityType is student). Class lists come from SIGAA without user accounts, so scores point at the enrollment.",
        condition: (data) => data?.entityType === "student",
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
      name: "completedTasks",
      type: "json",
      admin: {
        description:
          "For a checklist activity: ids of the tasks this student has done. The percentage below is then their share of the activity's tasks.",
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
