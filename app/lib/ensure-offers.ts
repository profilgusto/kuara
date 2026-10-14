/**
 * lib/ensure-offers.ts — gives courses the offer of a general offer (term).
 *
 * Used by the hooks of `terms`, `courses` and `site-settings`, so a course
 * has an offer for the period wherever the period or the course came from.
 */
import type { PayloadRequest } from "payload";

/**
 * Creates, for each given course, the offer of `period` when it does not
 * exist yet. Courses that already have one are left alone.
 */
export async function ensureOffersForPeriod(
  req: PayloadRequest,
  period: string,
  courseIds: number[],
): Promise<void> {
  for (const course of courseIds) {
    const existing = await req.payload.find({
      collection: "offers",
      where: {
        and: [{ course: { equals: course } }, { period: { equals: period } }],
      },
      depth: 0,
      limit: 1,
      req,
    });
    if (existing.totalDocs > 0) continue;
    await req.payload.create({
      collection: "offers",
      data: { period, course, status: "active" },
      req,
    });
  }
}

/** Every course of the platform. */
export async function allCourseIds(req: PayloadRequest): Promise<number[]> {
  const courses = await req.payload.find({
    collection: "courses",
    depth: 0,
    pagination: false,
    select: {},
    req,
  });
  return courses.docs.map((c) => c.id);
}
