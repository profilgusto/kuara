import type { CollectionBeforeChangeHook } from "payload";
import { joinsCourse } from "../lib/module-order.ts";

/**
 * Sends a module to the end of its course when it is created there or moved
 * there, so nobody has to type an `order` (the field is hidden in the admin).
 * From then on the order only changes through the reorder on the course page
 * or the "Ordenar Módulos" tab.
 */
export const assignModuleOrder: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (!joinsCourse(operation, data.course, originalDoc?.course)) return data;

  const courseId =
    typeof data.course === "object" ? data.course.id : data.course;
  const last = await req.payload.find({
    collection: "modules",
    where: {
      course: { equals: courseId },
      ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
    },
    sort: "-order",
    limit: 1,
    depth: 0,
    select: { order: true },
    req,
  });

  const lastOrder = Number(last.docs[0]?.order) || 0;
  return { ...data, order: lastOrder + 1 };
};
